import { api } from '../../core/api/client'
import { withSessionLock } from '../../core/auth/sessionCoordination'
import { sessionLost } from '../../core/api/events'
import { getConversation, sendMessage } from '../messenger/api'
import { uploadAttachment } from '../messenger/media/upload'
import { ShareController } from './controller'
import { incomingStorage } from './storage'
import { shareable } from './model'
let generation = 0
export const incomingShareGeneration = () => generation
export const shareController = new ShareController({
  save: value => incomingStorage.save(value),
  guard: (owner, signal, work) => {
    const current = generation
    return withSessionLock(async () => {
      if (signal.aborted || current !== generation) throw Error('Sharing was cancelled.')
      const actual = (await api.get<{ id: string }>('/me/', { signal })).data.id
      if (actual !== owner) { incomingShareBoundary(); sessionLost(); throw Error('Your account changed. Share the items again.') }
      if (signal.aborted || current !== generation) throw Error('Sharing was cancelled.')
      return work()
    })
  },
  eligible: async (conversation, files) => shareable(await getConversation(conversation), files),
  upload: uploadAttachment,
  send: (conversation, body, client_id, upload_ids, signal, owner) => sendMessage(conversation, { body, client_id, ...(upload_ids.length ? { upload_ids } : {}) }, signal, owner),
})
/** Confirmed sign-out/session loss only; pre-login restoration must retain the incoming review. */
export function incomingShareBoundary() { ++generation; shareController.cancel(); void incomingStorage.clear().catch(() => undefined) }
export { incomingStorage }
