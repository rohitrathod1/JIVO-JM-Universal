import { AppState } from 'react-native'
export function subscribeLifecycle(handler: (active: boolean) => void) {
  const sub = AppState.addEventListener('change', state => handler(state === 'active'))
  handler(AppState.currentState === 'active')
  return () => sub.remove()
}
