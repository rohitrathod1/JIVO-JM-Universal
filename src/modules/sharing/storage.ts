import type { IncomingShare } from './model'
export interface IncomingStorage { read(owner: string): Promise<IncomingShare | null>; save(value: IncomingShare): Promise<void>; clear(id?: string): Promise<void>; hasPending(): Promise<boolean> }
export const incomingStorage: IncomingStorage = { read: async () => null, save: async () => { throw Error('Incoming sharing is unavailable on this platform.') }, clear: async () => {}, hasPending: async () => false }
