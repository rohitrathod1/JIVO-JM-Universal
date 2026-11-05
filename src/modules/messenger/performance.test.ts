/// <reference types="node" />
import assert from 'node:assert/strict'
import { it } from 'vitest'
import fs from 'node:fs'
import { performance } from 'node:perf_hooks'
import { append, emptyWindow, MAX_MESSAGES } from './lib/window'
import { OutboxController, type PendingSend } from './outboxController'
import type { Message, MessageWindow } from './api'

it('bounds a 10,000-message history and drains 100 concurrent queued writes in order', async () => {
  const memoryBefore = process.memoryUsage().heapUsed
  const start = performance.now()
  let window = emptyWindow
  for (let batch = 0; batch < 100; batch++) {
    const results = Array.from({ length: 100 }, (_, index) => {
      const seq = batch * 100 + index + 1
      return { id: `synthetic-${seq}`, seq, conversation: 'synthetic-chat', body: 'Synthetic bounded history' } as Message
    })
    window = append(window, { results, last_seq: results[99].seq, visible_from_seq: 1, receipts: { read_seq: 0, delivered_seq: 0 }, server_time: new Date().toISOString(), has_more_before: true, has_more_after: false } as MessageWindow)
  }
  assert.equal(window.messages.length, MAX_MESSAGES)
  assert.equal(window.messages[0].seq, 9001)
  assert.equal(window.messages[999].seq, 10000)
  const historyMs = performance.now() - start
  const persisted = new Map<string, PendingSend>(); const sent: string[] = []
  let ordinal = 0
  const outbox = new OutboxController({
    storage: {
      read: async () => [...persisted.values()],
      put: async value => { persisted.set(value.payload.client_id, value) },
      remove: async (_owner, id) => { persisted.delete(id) },
      clear: async () => { persisted.clear() },
    },
    send: async (_conversation, payload) => { sent.push(payload.client_id); return { id: payload.client_id, seq: sent.length } as Message },
    network: () => false, message: String, delivered: () => {}, now: () => ++ordinal,
  })
  await outbox.bind('synthetic-owner')
  const queueStart = performance.now()
  const ids = Array.from({ length: 100 }, (_, index) => `synthetic-queue-${index}`)
  await Promise.all(ids.map(client_id => outbox.enqueue('synthetic-owner', 'synthetic-chat', { client_id, body: 'Synthetic queue' })))
  assert.equal(persisted.size, 100)
  outbox.setActive(true)
  for (let attempt = 0; attempt < 1000 && sent.length < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 1))
  await outbox.flush(); outbox.setActive(false)
  assert.deepEqual(sent, ids)
  assert.equal(persisted.size, 0)
  const report = {
    at: new Date().toISOString(), passed: true, scope: 'Synthetic client logic only; in-memory storage, no backend load or native rendering',
    history: { inputMessages: 10000, retained: window.messages.length, elapsedMs: Number(historyMs.toFixed(2)) },
    queue: { concurrentEnqueues: 100, orderedUniqueSends: sent.length, elapsedMs: Number((performance.now() - queueStart).toFixed(2)) },
    nodeHeapDeltaBytes: process.memoryUsage().heapUsed - memoryBefore,
  }
  fs.mkdirSync('test-results', { recursive: true })
  fs.writeFileSync('test-results/performance-smoke.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
})
