import { clearVaultSession } from '../../modules/passwords/session'
import { webPush } from '../../modules/notifications/webPush'
import { incomingShareBoundary } from '../../modules/sharing/incoming'
import { announceSessionBoundary,onOtherSessionBoundary,withSessionLock } from './sessionCoordination'
import { outbox } from '../../modules/messenger/outbox'
import { conversationDrafts } from '../../modules/messenger/drafts'
import { conversationCache } from '../../modules/messenger/conversationCache'
import { chatLock } from '../../modules/messenger/chatLock'
import { subscribeChatLockVisibility } from '../../modules/messenger/chatLockVisibility'
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { isAxiosError } from 'axios'
import { api, errorMessage, onSessionLost, origin, advanceSession } from '../api/client'
import { clearNativeCookies } from '../api/cookies'
import { SessionController } from './controller'
import { realtime } from '../realtime/socket'
import { subscribeLifecycle } from '../realtime/lifecycle'
import { watchUnreachable } from './autoRestore'
import type { Me } from './types'
import type { LoginResponse } from './security'
const Context = createContext<SessionController | null>(null)
export function SessionProvider({ children }: { children: ReactNode }) {
  const external=useRef({active:false, owner:null as string | null})
  // The constructor only stores callbacks; boundary refs are read on auth actions.
  // eslint-disable-next-line react-hooks/refs
  const [controller] = useState(() => new SessionController({
    boundary: preserve => { clearVaultSession(); void webPush.bind(null); if (!preserve && external.current.owner) { incomingShareBoundary(); external.current.owner = null } advanceSession(); chatLock.bind(null); conversationDrafts.bind(null); void conversationCache.bind(null, undefined, preserve); outbox.setActive(false); void outbox.bind(null, !preserve&&!external.current.active); if(!preserve&&!external.current.active)announceSessionBoundary() }, enabled: Boolean(origin), csrf: () => api.get('/auth/csrf/'),
    me: async () => (await api.get<Me>('/me/')).data,
    login: (email, password) => withSessionLock(async()=>{try{return (await api.post<LoginResponse>('/auth/login/', { email, password })).data}finally{announceSessionBoundary()}}),
    logout: () => withSessionLock(async()=>{try{return await api.post('/auth/logout/')}finally{announceSessionBoundary()}}),
    clear: () => origin ? clearNativeCookies(origin) : Promise.resolve(),
    unauthorized: e => isAxiosError(e) && e.response?.status === 401, message: errorMessage,
  }))
  useEffect(()=>onOtherSessionBoundary(()=>{outbox.setActive(false);external.current.active=true;try{controller.lose()}finally{external.current.active=false}}),[controller,external])
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  useEffect(() => {
    const unsubscribe = onSessionLost(controller.lose)
    void controller.restore()
    return () => { unsubscribe(); controller.dispose() }
  }, [controller])
  // An unreachable restore (cold start offline, server down) recovers by itself: when the device comes back
  // online or to the foreground, and on a capped backoff, so queued messages drain without the user tapping Retry.
  const restoreAttempts = useRef(0)
  useEffect(() => {
    if (state.status === 'ready') restoreAttempts.current = 0
    if (state.status !== 'unreachable') return
    return watchUnreachable({ subscribe: subscribeLifecycle, attempts: restoreAttempts.current, restore: reason => { restoreAttempts.current = reason === 'timer' ? restoreAttempts.current + 1 : 0; void controller.restore() } })
  }, [controller, state.status])
  useEffect(() => {
    if (state.status !== 'ready') { realtime.stop(); return }
    if (external.current.owner && external.current.owner !== state.me?.id) incomingShareBoundary()
    external.current.owner = state.me?.id ?? null
    conversationDrafts.bind(state.me?.id ?? null)
    chatLock.bind(state.me?.id ?? null)
    void conversationCache.bind(state.me?.id ?? null, state.me?.session?.expires_at)
    void outbox.bind(state.me?.id ?? null)
    let bound = true
    void webPush.bind(state.me?.id ?? null).then(() => { if (bound) void webPush.sync() }).catch(() => undefined)
    const offCache = realtime.on('*', conversationCache.event)
    realtime.start()
    const off = subscribeLifecycle(active => { realtime.setActive(active); outbox.setActive(active) })
    const offVisibility = subscribeChatLockVisibility(foreground => { if (foreground) controller.checkExpiry(); chatLock.visibility(foreground) })
    const reconnect = realtime.on('HELLO', () => void outbox.flush())
    // REST can recover before WebSockets. Do not strand queued sends until a socket reconnects.
    const retry = setInterval(() => void outbox.flush(), 15000)
    return () => { bound = false; off(); offVisibility(); offCache(); reconnect(); clearInterval(retry); outbox.setActive(false); realtime.stop() }
  }, [controller, external, state.status, state.me?.id, state.me?.session?.expires_at])
  return <Context.Provider value={controller}>{children}</Context.Provider>
}
export function useSession() {
  const controller = useContext(Context)
  if (!controller) throw new Error('SessionProvider missing')
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  return { ...state, adopt: () => controller.adopt(), logout: () => controller.logout(),
    login: (email: string, password: string) => controller.login(email, password), retry: () => controller.restore() }
}

