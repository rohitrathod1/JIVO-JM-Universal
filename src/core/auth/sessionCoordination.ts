export async function withSessionLock<T>(work:()=>Promise<T>):Promise<T>{return work()}
export function announceSessionBoundary(){}
export function onOtherSessionBoundary(_handler:()=>void){return()=>{}}
