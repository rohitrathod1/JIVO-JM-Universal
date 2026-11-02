import { announceSessionBoundary,onOtherSessionBoundary,withSessionLock } from './sessionCoordination'
import { outbox } from '../../modules/messenger/outbox'
import { conversationDrafts } from '../../modules/messenger/drafts'
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { isAxiosError } from 'axios'
import { api, errorMessage, onSessionLost, origin, advanceSession } from '../api/client'
import { clearNativeCookies } from '../api/cookies'
import { SessionController } from './controller'
import { realtime } from '../realtime/socket'
import { subscribeLifecycle } from '../realtime/lifecycle'
import type { Me } from './types'
import type { LoginResponse } from './security'
const Context = createContext<SessionController | null>(null)
export function SessionProvider({ children }: { children: ReactNode }) {
  const [external]=useState(()=>({active:false}))
  const [controller] = useState(() => new SessionController({
    boundary: preserve => { advanceSession(); conversationDrafts.bind(null); outbox.setActive(false); void outbox.bind(null, !preserve&&!external.active); if(!preserve&&!external.active)announceSessionBoundary() }, enabled: Boolean(origin), csrf: () => api.get('/auth/csrf/'),
    me: async () => (await api.get<Me>('/me/')).data,
    login: (email, password) => withSessionLock(async()=>{try{return (await api.post<LoginResponse>('/auth/login/', { email, password })).data}finally{announceSessionBoundary()}}),
    logout: () => withSessionLock(async()=>{try{return await api.post('/auth/logout/')}finally{announceSessionBoundary()}}),
    clear: () => origin ? clearNativeCookies(origin) : Promise.resolve(),
    unauthorized: e => isAxiosError(e) && e.response?.status === 401, message: errorMessage,
  }))
  useEffect(()=>onOtherSessionBoundary(()=>{outbox.setActive(false);external.active=true;try{controller.lose()}finally{external.active=false}}),[controller,external])
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  useEffect(() => {
    const unsubscribe = onSessionLost(controller.lose)
    void controller.restore()
    return unsubscribe
  }, [controller])
  useEffect(() => {
    if (state.status !== 'ready') { realtime.stop(); return }
    conversationDrafts.bind(state.me?.id ?? null)
    void outbox.bind(state.me?.id ?? null)
    realtime.start()
    const off = subscribeLifecycle(active => { realtime.setActive(active); outbox.setActive(active) })
    const reconnect = realtime.on('HELLO', () => void outbox.flush())
    // REST can recover before WebSockets. Do not strand queued sends until a socket reconnects.
    const retry = setInterval(() => void outbox.flush(), 15000)
    return () => { off(); reconnect(); clearInterval(retry); outbox.setActive(false); realtime.stop() }
  }, [state.status, state.me?.id])
  return <Context.Provider value={controller}>{children}</Context.Provider>
}
export function useSession() {
  const controller = useContext(Context)
  if (!controller) throw new Error('SessionProvider missing')
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  return { ...state, adopt: () => controller.adopt(), logout: () => controller.logout(),
    login: (email: string, password: string) => controller.login(email, password), retry: () => controller.restore() }
}

