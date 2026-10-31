import { useCallback, useEffect, useState } from 'react'
export function useResource<T>(load: () => Promise<T>) {
  const [revision, setRevision] = useState(0)
  const [snapshot, setSnapshot] = useState<{ owner: () => Promise<T>; revision: number; value: T | null; error: unknown } | null>(null)
  useEffect(() => {
    let active = true
    void load().then(value => { if (active) setSnapshot({ owner: load, revision, value, error: null }) }).catch(error => { if (active) setSnapshot({ owner: load, revision, value: null, error }) })
    return () => { active = false }
  }, [load, revision])
  const current = snapshot?.owner === load && snapshot.revision === revision ? snapshot : null
  const refresh = useCallback(() => setRevision(v => v + 1), [])
  return { value: current?.value ?? null, error: current?.error ?? null, loading: current === null, refresh }
}
