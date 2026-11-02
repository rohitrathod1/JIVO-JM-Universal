import type { IncomingShare, SharePlan } from './model'
import type { PickedFile } from '../messenger/media/model'
export interface ShareDependencies {
  save(value: IncomingShare): Promise<void>
  guard<T>(owner: string, signal: AbortSignal, work: () => Promise<T>): Promise<T>
  eligible(conversation: string, hasFiles: boolean): Promise<boolean>
  upload(file: PickedFile, key: string, signal: AbortSignal, progress: (fraction: number) => void): Promise<{ id: string }>
  send(conversation: string, body: string, clientId: string, uploads: string[], signal: AbortSignal, owner: string): Promise<unknown>
}
/** An explicit attempt; retries reuse durable IDs and skip confirmed completed destinations. */
export class ShareController {
  private active: AbortController | null = null
  constructor(private readonly deps: ShareDependencies) {}
  cancel() { this.active?.abort() }
  async send(value: IncomingShare, plan: SharePlan, progress: (text: string) => void) {
    if (this.active) throw Error('This share is already sending.')
    if (!value.owner) throw Error('Sign in before sending this share.')
    const abort = new AbortController(); this.active = abort
    const check = () => { if (abort.signal.aborted) throw Error('Sharing cancelled. Some completed destinations may already have received it; retry continues remaining destinations.') }
    const current = { ...value, plan }
    try {
      await this.deps.save(current); check()
      for (const job of plan.jobs) {
        if (job.sent) continue
        check()
        if (!await this.deps.eligible(job.conversation, value.files.length > 0)) throw Error(`${job.title} is locked or cannot receive this share.`)
        for (const [index, file] of value.files.entries()) {
          if (job.uploadIds[index]) continue
          check()
          const upload = await this.deps.guard(value.owner, abort.signal, () => this.deps.upload(file, job.uploadKeys[index], abort.signal, fraction => progress(`${job.title} · Uploading ${index + 1} of ${value.files.length} (${Math.round(fraction * 100)}%)`)))
          check(); job.uploadIds[index] = upload.id
          await this.deps.save(current)
        }
        check(); progress(`Sending to ${job.title}…`)
        await this.deps.guard(value.owner, abort.signal, async () => {
          if (!await this.deps.eligible(job.conversation, value.files.length > 0)) throw Error(`${job.title} is no longer available.`)
          check()
          return this.deps.send(job.conversation, plan.caption, job.clientId, job.uploadIds.filter((id): id is string => id !== null), abort.signal, value.owner!)
        })
        check(); job.sent = true; await this.deps.save(current)
      }
    } finally { if (this.active === abort) this.active = null }
  }
}
