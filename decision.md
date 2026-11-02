# Universal migration decisions

All decisions are subject to the acceptance evidence in [testing.md](testing.md). The source reference and inventory are described in [design.md](design.md) and [FEATURE-PARITY-CHECKLIST.md](FEATURE-PARITY-CHECKLIST.md).

## U-001: Keep the working TypeScript architecture

Continue the existing Expo 58 / React Native 0.88 / Expo Router application, rather than replacing functional authentication, messenger, vault and administration flows. Application code is strict TypeScript. Node harnesses may retain `.cjs`; Python and PowerShell remain appropriate for local checks/build orchestration. The initial cycle reused existing dependencies; the continuation adds SDK-compatible `expo-location` for foreground native location. Native incoming sharing uses the existing Expo sharing module and generated configuration.

## U-002: Treat reference projects as read-only

Copy required branding into Universal and consume the current backend contracts. Do not run migrations or alter reference files. The latest user confirmation excludes the unified Approvals page. Existing approval operations inside administration and vault flows are preserved.

## U-003: Persist before acknowledging a queued send

`enqueue()` is asynchronous and resolves after durable storage writes. UI clears its draft only after that resolution. Retry delays grow from 1 second to a 60-second cap and persist across restarts. Queued items are ordered, and a delayed item is not overtaken by a newer queued item. Permanent errors require explicit retry/discard. The backend's stable client ID is retained through every attempt.

## U-004: Bound protected native history; do not invent offline authentication

Reuse the existing chunked SecureStore snapshot implementation rather than add a native database dependency solely for bounded recent-history access. This is a bounded recent-history cache, not a full message database. Native history is account/session bound, age limited and excludes locked content. Browser history stays in memory; the existing IndexedDB outbox remains persistent but unencrypted. Full encrypted browser persistence and authenticated cold-start offline access require a separate unlock/revocation design.

## U-005: Conceal locked and disappearing content

The backend's detail/history routes do not themselves substitute for the reference client lock gate. Universal now supplies an account-bound memory gate, locked-list verification through the server's existing app-unlock step-up, lock/unlock settings, and five-minute background relock. In-flight attempts cannot reopen views after account or lifecycle invalidation. Locked content is never retained in the persistent recent-history cache. Expired messages are filtered from live and cached windows; disappearing settings use the existing endpoint. SessionController also checks absolute session expiry on a timer and foreground, so a warm offline screen cannot outlive its known session deadline. Full factor/device acceptance remains pending.

## U-006: Record the account-binding contract discrepancy

Backend `decision.md` BE-023 and `flow.md` describe `X-JM-Expected-User` enforcement. A source search of its Python files in this cycle found no implementation. Universal supplies the documented header, retains pre-send identity validation and browser session locking, but cannot guarantee that another client changing a shared session between validation and mutation is rejected by the server. No backend change was made. A future backend owner must resolve the documented-contract/runtime mismatch and provide a negative integration test.

## U-007: Cache only the public web shell

The service worker uses a build-generated asset allowlist and known SPA routes. API, private files, map tiles and socket traffic remain network-only. An available update waits for explicit Reload. Offline shell startup is tested independently from offline sign-in and message persistence. Web transport uses the actual browser origin; native transport retains its configured API origin.

## U-008: Separate current evidence from historical passes

Earlier Android and real two-client smoke reports are historical evidence. A read-only preflight found the isolated smoke database missing `files_upload.discarded_at` and `messenger_eventreminder`; it was not migrated. The user subsequently supplied two accounts and started the existing backend for an explicitly authorized current-source test. The production web build passed both UI logins/CSRF 204, authenticated WebSocket HELLO, cross-account MESSAGE_CREATED, reconnect catch-up, offline queue flush, and reload session/history restoration. Backend results contained each of the three test messages once; all three were removed and both sessions logged out. `test-results/live-account-smoke.json` records the 10:58:11 UTC completion with no page errors. This resolves the immediate real messaging validation gap without changing backend source/schema; it does not validate every event/reminder/permission path or establish unconditional exactly-once delivery. Native runtime evidence remains narrower: existing emulator account/list and WebSocket connection, plus synthetic share review/discard without sending.

## U-009: Distinguish the initial cycle from continuation

The master prompt permits an incomplete, accurately reported initial cycle. Specialist roles work concurrently within four available slots and rotate as tasks complete. No public deployment or store submission occurs. Later work belongs to the authorized continuation and must not be represented as completed inside the original hour. Remaining native credentials/infrastructure, detailed visual parity, real push delivery and device checks stay explicit in the checklist. Current source uses an OS dialer shortcut; stale reference documents describing WebRTC do not authorize inventing a new calling subsystem. [testing.md](testing.md) is the release gate; compilation alone is not production readiness.

## U-010: Preserve preference and message presentation behavior

Persist light/dark/system choice as a device preference, using browser storage or native SecureStore. The preference is independent of account/private cache ownership. Keep the source-compatible capability landing route and separate Home screen. Receipt ticks, day separators, compact composer, action menus and immersive phone chrome map the reference's visible behavior; their presence does not establish pixel equality or full accessibility acceptance.

## U-011: Use existing map/event contracts and a shared map renderer

Use the existing JM tile proxy, place search and reverse lookup rather than direct client requests to map providers. Native foreground location uses `expo-location`; denied/unavailable permission leaves search and map selection available. Event editing sends the existing API shape and reminder options. Calendar export revalidates the current event and emits escaped/folded ICS; the destination calendar's acceptance is outside the app's confirmation. Events/locations still require connectivity and do not extend the text outbox into an unreviewed generic mutation queue.

## U-012: Receive shares into review and persist a retry plan

Android native receiving and PWA multipart share-target intake lead to `/share`, never automatic sending. Cap intake, bind it to the authenticated account, recheck destination permissions, and persist recipients/message IDs/upload keys before mutation. Per-chat retries skip confirmed completions. Browser intake is separate IndexedDB storage and remains origin-readable plaintext; native metadata uses protected snapshots while provider file access remains subject to OS URI lifetimes. iOS sharing stays disabled without the required identifiers/signing. Expo native receiving remains experimental. See [docs/INCOMING-SHARING.md](docs/INCOMING-SHARING.md).

## U-013: Connect browser push without claiming native or provider success

Permission is requested from an explicit action. Subscription work and cleanup are serialized with account epochs/shared-session coordination; stale permission/network completions cannot enable the next account. The existing backend supplies VAPID and subscription/test endpoints. The service worker handles bounded payloads and safe destinations, while its Cache Storage remains public-static-only. Live server/provider delivery, Safari installation and native push require separate validation. The final test results are recorded only in [testing.md](testing.md).
