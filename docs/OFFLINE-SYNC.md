# Offline synchronization implementation - 2 November 2026

Scope: Universal only; frontend/backend are read-only references. This is a bounded local-development implementation, not a claim of full offline authentication or production parity.

## Durable outbound queue

`outboxController.ts` resolves `enqueue` only after platform persistence succeeds. The caller must await that promise before clearing the composer. Until then no queued bubble is published. A write failure leaves the draft with the caller and pauses synchronization. Duplicate concurrent enqueue calls share the same persistence operation. Native writes use the existing chunked SecureStore snapshot; browser writes use the existing account-bound IndexedDB store.

Retryable network errors and HTTP 408, 429, 500, 502, 503, and 504 retry after 1, 2, 4, 8, 16, 32, then at most 60 seconds. Retry metadata survives restoration; an older delayed message cannot be overtaken by a newer queued message. Backgrounding aborts active sends without increasing retry delay. Foreground, REST retry interval, and WebSocket HELLO continue to trigger draining, respecting the stored next-attempt time. Permanent refusals remain visibly failed with explicit retry/discard.

The existing backend `messenger/services.py` deduplicates sends by `(sender, client_id)` and its model has a corresponding uniqueness constraint. The client preserves the UUID through retries and interruption. This supports idempotent message creation, not an unconditional exactly-once network delivery claim. Identity is checked before sending; cross-tab changes between that check and mutation remain a limitation. Although backend decision BE023 describes `X-JM-Expected-User`, implementation was not found in current Python source; the compatible client header is not treated as a server guarantee.

## Recent history cache

`conversationCache.ts` exports a shared `ConversationCache` with `bind`, `get`, `put`, `remove`, `list`, `rememberList`, and `flush` methods. Bind only after a successful server `/me/` response, passing owner ID and session expiry. Passing null immediately denies reads; default null binding clears persistence. A preserving null binding is solely for session restoration, and still denies reads until online authentication succeeds.

Native storage uses `SecureSnapshot` and `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, with versioned chunk publication, without adding a native dependency or altering generated Android/iOS files. Snapshots coalesce writes for 500 ms and retain at most 10 conversations, 40 messages per conversation, and 200,000 serialized JavaScript characters total. Cache lifetime is at most 30 minutes and never exceeds the authenticated session expiry. Expired or wrong-account records are discarded. Disappeared messages and messages beneath `visible_from_seq` are omitted. Locked/left conversations are excluded. Cached list rows omit message previews because the list protocol does not provide their expiry metadata.

Web recent history remains in tab memory. The existing web outbound queue still persists in IndexedDB; adding durable private browser history without an appropriate unlock/key design is deferred. Encrypting browser history with a key persisted next to it would not solve the underlying local disclosure risk.

`HistoryController` receives an optional cache dependency, saves synchronized windows, uses cached history only after network failure (never cancellation or authorization failure), removes cache on access loss, and reconciles through the existing REST sequence protocol. It hides locked chat content immediately, including a lock event while history is loading. `expire()` removes disappearing content without rewriting unchanged snapshots on each clock tick. Cold startup while the backend cannot validate the session remains locked; cache contents alone never establish authentication.

## Validation

Targeted tests cover durable-before-visible enqueue, write failure, duplicate enqueue, owner boundaries, persisted backoff, ordering, interruption, protected cache restore, session/cache expiry, wrong owner, corruption, locked and disappearing content, byte budget, coalescing, lost-access invalidation, offline history fallback, and cancellation exclusion. Run:

```powershell
npm.cmd run typecheck
npx.cmd eslint src/modules/messenger/outboxController.ts src/modules/messenger/outboxController.test.ts src/modules/messenger/outbox.ts src/modules/messenger/history.ts src/modules/messenger/history.test.ts src/modules/messenger/conversationCache*.ts --max-warnings=0
npx.cmd vitest run src/modules/messenger/outboxController.test.ts src/modules/messenger/history.test.ts src/modules/messenger/conversationCacheController.test.ts --testTimeout=20000
```

Focused result this cycle: 46 tests across 3 files passed; complete application/tool/PWA typechecks passed; targeted lint passed with zero warnings. The migration lead records final combined results in `../testing.md`. Native storage integration relies on the existing SecureSnapshot adapter previously tested on Android; the new history cache still requires fresh native device validation. Background synchronization requires reopening/foregrounding the app when the OS suspends it. Unsynchronized attachments still require the existing upload flow; this change does not invent a persistent offline binary-upload protocol. HTTP Retry-After hints are not yet consumed; bounded client retry is used. Visual cache notices and list integration are handled by the main application integration.

SDK references checked: https://docs.expo.dev/versions/v58.0.0/sdk/securestore/ and https://docs.expo.dev/versions/v58.0.0/sdk/crypto/.
