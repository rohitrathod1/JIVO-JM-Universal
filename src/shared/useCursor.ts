import { useEffect, useState, useSyncExternalStore } from 'react'
import { CursorController, type CursorPage } from './cursor'
import { errorMessage } from '../core/api/client'
export function useCursor<T extends { id: string | number }>(load: (cursor?: string | null) => Promise<CursorPage<T>>) {
  const [controller] = useState(() => new CursorController<T>(errorMessage))
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  useEffect(() => { void controller.reset(load); return controller.invalidate }, [controller, load])
  return { ...state, more: controller.more, refresh: controller.refresh }
}
