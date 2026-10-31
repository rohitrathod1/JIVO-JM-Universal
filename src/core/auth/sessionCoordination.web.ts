const key='jm-auth-boundary-v1'
export async function withSessionLock<T>(work:()=>Promise<T>):Promise<T>{if(!navigator.locks)throw Error('This browser cannot safely coordinate shared-session actions across tabs. Use a supported browser.');return navigator.locks.request('jm-shared-cookie-session',work)}
export function announceSessionBoundary(){try{localStorage.setItem(key,crypto.randomUUID())}catch{/* Per-send identity revalidation still fails closed. */}}
export function onOtherSessionBoundary(handler:()=>void){const listener=(event:StorageEvent)=>{if(event.key===key)handler()};window.addEventListener('storage',listener);return()=>window.removeEventListener('storage',listener)}
