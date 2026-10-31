import { origin } from '../api/client'
import { sessionLost } from '../api/events'
import { RealtimeClient, type Socket } from './client'
export const realtime = new RealtimeClient(origin ? `${origin.replace(/^http/, 'ws')}/ws/` : '', url => new WebSocket(url) as unknown as Socket, sessionLost)
