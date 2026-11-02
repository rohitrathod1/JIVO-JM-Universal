/** Composer text stays in this session's memory, matching the original web client. */
export class ConversationDrafts {
  private owner: string | null = null
  private values = new Map<string, string>()
  bind(owner: string | null) { if (this.owner !== owner) { this.values.clear(); this.owner = owner } }
  read(owner: string, conversation: string) { return owner === this.owner ? this.values.get(conversation) ?? '' : '' }
  write(owner: string, conversation: string, text: string) {
    if (!owner || owner !== this.owner) return
    this.values.delete(conversation)
    if (text) this.values.set(conversation, text)
    if (this.values.size > 100) this.values.delete(this.values.keys().next().value!)
  }
}
export const conversationDrafts = new ConversationDrafts()
