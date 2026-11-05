import { useEffect, useState, useSyncExternalStore } from 'react'
import { onSessionLost } from '../../core/api/client'
import { useSession } from '../../core/auth/Session'
import { subscribeLifecycle } from '../../core/realtime/lifecycle'
import { realtime } from '../../core/realtime/socket'
import { atlasApi, atlasStatus } from './api'
import { AtlasStore, type StatusEntry } from './store'
import { AtlasThread } from './thread'

export const atlasStore = new AtlasStore(atlasStatus)
onSessionLost(() => atlasStore.clear())
const NONE: StatusEntry = { value: null, at: 0, loading: false, failed: false }

/**
 * The person's Atlas status entry (`value` is null while unknown). Callers hide the Atlas entry unless
 * `value.enabled`; the server still checks JM_ATLAS_USE and identity on every call.
 */
export function useAtlasStatusEntry() {
  const { me, status } = useSession()
  const user = status === 'ready' ? me?.id ?? null : null
  useEffect(() => {
    if (!user) { atlasStore.bind(null); return }
    void atlasStore.refreshStatus(user)
  }, [user])
  const entry = useSyncExternalStore(atlasStore.subscribe, atlasStore.statusEntry, atlasStore.statusEntry)
  return { ...(user ? entry : NONE), retry: () => { if (user) void atlasStore.refreshStatus(user, true) } }
}

/** `{ enabled, allowed, message }` or null while unknown: the Messenger button shows only when `enabled`. */
export const useAtlasStatus = () => useAtlasStatusEntry().value

/** True while the app is backgrounded or the device is disconnected (the shared realtime status). */
export function useOffline() {
  return useSyncExternalStore(realtime.subscribe, realtime.snapshot, realtime.snapshot) === 'offline'
}

/**
 * One person's Atlas thread. Starts from the memory cache (so earlier questions show offline), loads the first
 * page when active, polls open asks per the contract and pauses while the app is inactive. Mount it keyed by
 * the user id.
 */
export function useAtlasThread(user: string, enabled: boolean) {
  // The status hook binds the store to this person; until then readThread is empty and nothing is saved.
  const [thread] = useState(() => new AtlasThread(atlasApi, undefined, atlasStore.readThread(user), value => atlasStore.saveThread(user, value)))
  useEffect(() => {
    if (!enabled) return
    // The lifecycle reports the current state at once, so this also performs the first load when active.
    const off = subscribeLifecycle(active => thread.setActive(active))
    return () => { off(); thread.setActive(false) }
  }, [thread, enabled])
  const state = useSyncExternalStore(thread.subscribe, thread.snapshot, thread.snapshot)
  return { ...state, thread }
}
