import { createContext, useContext, useEffect, type Dispatch, type SetStateAction } from 'react'

/** Presentation-only signal. Selection/auth/navigation state remain owned by their existing controllers. */
export const WorkspaceChrome = createContext<Dispatch<SetStateAction<boolean>>>(() => {})

/** Hide the phone shell while an open chat occupies the screen; restore it on back/unmount. */
export function useChatImmersive(active: boolean) {
  const setImmersive = useContext(WorkspaceChrome)
  useEffect(() => {
    setImmersive(active)
    return () => setImmersive(false)
  }, [active, setImmersive])
}
