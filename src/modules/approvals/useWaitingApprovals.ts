import { useEffect, useState } from 'react'
import { listApprovals, onApprovalsChanged } from './api'

/** How many approvals wait on this person (the navigation badge). Polls every minute like the web app. */
export function useWaitingApprovals(enabled: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) { setCount(0); return }
    let active = true
    const load = () => { void listApprovals('pending').then(r => { if (active) setCount(r.waiting_on_me ?? 0) }).catch(() => { /* badge only; the page shows errors */ }) }
    load()
    const timer = setInterval(load, 60_000)
    const off = onApprovalsChanged(load)
    return () => { active = false; clearInterval(timer); off() }
  }, [enabled])
  return enabled ? count : 0
}
