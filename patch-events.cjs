const fs=require('fs');const edit=(p,fn)=>fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));
edit('src/components/AdminPanel.tsx',s=>s.replace('admin.updateGroup(group.id, values) })} /></Card>', 'admin.updateGroup(group.id, values) })} />}</Card>'));
edit('src/modules/messenger/history.ts',s=>{
s=s.replace('private reconciling = false','private reconciling = false\n  private queued: Frame[] = []\n  private drain() { if (this.state.loading || this.reconciling) return; const queued = this.queued.splice(0); queued.forEach(frame => this.event(frame)) }');
s=s.replace('this.generation++; this.reconciling = false','this.generation++; this.reconciling = false; this.queued = []');
s=s.replace('const generation = ++this.generation; this.reconciling = false','const generation = ++this.generation; this.reconciling = false; this.queued = []');
s=s.replaceAll("this.deps.message(error) }) }\n  }", "this.deps.message(error) }) }\n    finally { if (generation === this.generation) this.drain() }\n  }");
s=s.replaceAll("loading: false }) }\n  }", "loading: false }) }\n    finally { if (generation === this.generation) this.drain() }\n  }");
s=s.replace('finally { if (generation === this.generation) this.reconciling = false }','finally { if (generation === this.generation) { this.reconciling = false; this.drain() } }');
s=s.replace("  event = (frame: Frame) => {", "  event = (frame: Frame) => {\n    if (!this.state.id) return\n    if (this.state.loading || this.reconciling) { this.queued.push(frame); return }");
s=s.replace("} else if (['MESSAGE_UPDATED', 'REACTION_UPDATED', 'POLL_UPDATED'].includes(frame.type)) {\n      void this.reconcile()",` } else if (frame.type === 'MESSAGE_UPDATED' && seq !== null) {
      const patch = { body: data.body, edited_at: data.edited_at, updated_at: data.updated_at, mentions: data.mentions } as Partial<Message>
      this.publish({ ...this.state, window: window.patchMessage(this.state.window, seq, patch) })
    } else if (frame.type === 'REACTION_UPDATED' && seq !== null) {
      this.publish({ ...this.state, window: window.patchMessage(this.state.window, seq, { reactions: data.reactions as Message['reactions'] }) })
    } else if (frame.type === 'POLL_UPDATED' && seq !== null) {
      this.publish({ ...this.state, window: window.patchMessage(this.state.window, seq, { poll: data.poll as Message['poll'] }) })
    } else if (['MESSAGE_READ', 'MESSAGE_DELIVERED'].includes(frame.type) && data.receipts) {
      this.publish({ ...this.state, window: window.advanceReceipts(this.state.window, data.receipts as window.WindowState['receipts']) })`);
s=s.replace("if (frame.type === 'CONVERSATION_CLEARED') void this.latest()", "if (frame.type === 'CONVERSATION_CLEARED' || (frame.type === 'CONVERSATION_SETTINGS' && typeof data.cleared_seq === 'number' && data.cleared_seq >= this.state.window.visibleFrom)) void this.latest()");return s;
});
edit('src/components/ConversationWorkspace.tsx',s=>s.replace("import { HistoryController }", "import { statusFor } from '../modules/messenger/lib/window'\nimport { HistoryController }").replace("${m.status || 'sent'}", "${statusFor(m, me.id, historyState.window.receipts) || m.status || 'sent'}"));
edit('mocked-ui.cjs',s=>s.replace("await page.screenshot({ path:","await page.getByRole('button', { name: 'Close actions', exact: true }).waitFor({ state: 'hidden' })\n      await page.screenshot({ path:"));
