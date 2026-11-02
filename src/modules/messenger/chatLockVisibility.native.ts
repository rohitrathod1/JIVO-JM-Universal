import { AppState } from 'react-native'
/** SDK58/RN0.88 AppState, deliberately independent of connectivity. */
export function subscribeChatLockVisibility(listener: (foreground: boolean) => void): () => void {
  const subscription = AppState.addEventListener('change', state => listener(state === 'active'))
  listener(AppState.currentState === 'active')
  return () => subscription.remove()
}
