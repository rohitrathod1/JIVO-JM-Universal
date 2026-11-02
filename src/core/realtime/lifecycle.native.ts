import { AppState } from 'react-native'
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network'
export function subscribeLifecycle(handler: (active: boolean) => void) {
  let alive = true
  let foreground = AppState.currentState === 'active'
  let connected = true
  let revision = 0
  const update = () => { if (alive) handler(foreground && connected) }
  const sub = AppState.addEventListener('change', state => { foreground = state === 'active'; update() })
  // A LAN backend can work without public internet access; only physical disconnect pauses it.
  const network = addNetworkStateListener(state => { revision++; connected = state.isConnected !== false; update() })
  void getNetworkStateAsync().then(state => { if (revision === 0) { connected = state.isConnected !== false; update() } }).catch(() => {})
  update()
  return () => { alive = false; sub.remove(); network.remove() }
}
