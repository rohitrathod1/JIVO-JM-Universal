import { api } from '../../../core/api/client'
import { realtime } from '../../../core/realtime/socket'
import { getUpload, type Attachment } from '../api'
import { uploadForm } from './form'
import { uploadLimitError, type PickedFile } from './model'
import { awaitScan } from './scan'
export async function uploadAttachment(asset: PickedFile, idempotencyKey: string, signal: AbortSignal, progress: (value: number) => void, purpose: 'attachment' | 'avatar' | 'background' | 'group_avatar' = 'attachment') {
  const error = purpose === 'attachment' ? uploadLimitError(asset) : null; if (error) throw new Error(error)
  const { data } = await api.post<Attachment>('/uploads/', uploadForm(asset, purpose), {
    signal, headers: { 'Idempotency-Key': idempotencyKey }, timeout: purpose === 'attachment' && asset.size > 50 * 1024 * 1024 ? 900000 : 120000,
    onUploadProgress: event => { if (event.total) progress(event.loaded / event.total) },
  })
  return awaitScan(data, { read: getUpload, subscribe: handler => {
    const ready = realtime.on<Attachment>('UPLOAD_READY', frame => handler(frame.data))
    const rejected = realtime.on<Attachment>('UPLOAD_REJECTED', frame => handler(frame.data))
    return () => { ready(); rejected() }
  } }, signal, asset.size > 50 * 1024 * 1024 ? 900000 : 120000)
}
