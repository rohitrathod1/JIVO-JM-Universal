import { AppState } from 'react-native'
export function watchVaultActivity(_touch:()=>void,check:()=>void){const listener=AppState.addEventListener('change',check);const timer=setInterval(check,15000);return()=>{listener.remove();clearInterval(timer)}}
