import { useSyncExternalStore } from 'react'
import { Appearance } from 'react-native'
const subscribe=(changed:()=>void)=>{const listener=Appearance.addChangeListener(changed);return()=>listener.remove()}
const snapshot=()=>Appearance.getColorScheme() ?? 'light'
// Recheck after subscribing: a scheme change between render and effect must not be missed.
export function useSystemColorScheme(){return useSyncExternalStore(subscribe,snapshot,()=> 'light' as const)}
