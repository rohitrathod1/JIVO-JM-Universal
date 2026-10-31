import type {ReactNode} from 'react'
import {Card,Label} from '../ui'
export function AppLock({children}:{children:ReactNode}){return <>{children}</>}
export function AppLockSetting(){return <Card><Label>Device passkey app lock is unavailable on native until passkey integration is validated.</Label></Card>}
