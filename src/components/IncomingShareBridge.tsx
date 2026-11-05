import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { router, usePathname } from 'expo-router'
import { useSession } from '../core/auth/Session'
import { incomingStorage, incomingShareGeneration } from '../modules/sharing/incoming'
export function IncomingShareBridge() {
  const { me, status } = useSession()
  const path = usePathname()
  const shown = useRef<string | null>(null)
  useEffect(() => {
    if (status !== 'ready' || !me) { shown.current = null; return }
    let active = true
    const generation = incomingShareGeneration()
    const inspect = async () => {
      if (!await incomingStorage.hasPending()) return
      if (!active || generation !== incomingShareGeneration()) return
      if (path !== '/share' && shown.current !== me.id) { shown.current = me.id; router.push('/share') }
    }
    void inspect().catch(() => undefined)
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') { shown.current = null; void inspect().catch(() => undefined) } })
    return () => { active = false; subscription.remove() }
  }, [me, path, status])
  return null
}
