# Universal migration decisions

All decisions are subject to the acceptance evidence in [testing.md](testing.md). The source reference and inventory are described in [design.md](design.md) and [FEATURE-PARITY-CHECKLIST.md](FEATURE-PARITY-CHECKLIST.md).

## U-001: Keep the working TypeScript architecture

Continue the existing Expo 58 / React Native 0.88 / Expo Router application, rather than replacing functional authentication, messenger, vault and administration flows. Application code is strict TypeScript. Node harnesses may retain `.cjs`; Python and PowerShell remain appropriate for local checks/build orchestration. The initial cycle reused existing dependencies; the continuation adds SDK-compatible `expo-location` for foreground native location. Native incoming sharing uses the existing Expo sharing module and generated configuration.

## U-002: Treat reference projects as read-only

Copy required branding into Universal and consume the current backend contracts. Do not run migrations or alter reference files. The unified Approvals page, excluded earlier, is in scope since the user's 02-Nov-2026 exact-parity request (U-014). Existing approval operations inside administration and vault flows are preserved.

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

## U-014: Exact-parity pass; Approvals included; Jivo Auth follows FE-033/FE-034

On 02-Nov-2026 the user asked for exact parity, so `/approvals` (FE-023) is implemented against the backend `core.approvals` contract; decisions post only to the item's own JM or JP action path. In Jivo mode Universal follows FE-033/BE-083: people are mirrored automatically, so the FE-032 Add person sheet, the Invited filter and invitation/reset actions are not shown, and that client code was removed. Profile shows the central name and email read-only and offers password change only when `/auth/options/` advertises `password_change`; the advertised `name_change` is parsed but not offered, per FE-034. Local mode is unchanged. Evidence and remaining gaps: [testing.md](testing.md).


## U-015: Block screen capture over vault secrets and the lock cover; auto-clear copied secrets

E2E findings SEC-1/SEC-2. Native uses `expo-screen-capture` (~58.0.6, via `npx expo install`; no config plugin needed): a reference-counted `ScreenCaptureGuard` (`src/shared/screenCaptureGuard.ts`) prevents screenshots and recording (Android FLAG_SECURE, which also blanks the recents thumbnail) while a vault secret is revealed (`SecretCopy` is mounted only then) and while the app-lock cover is shown; with app lock on, the iOS app-switcher snapshot is blurred. Native calls are serialised so a fast reveal/hide settles on the right state; unsupported devices fail quietly. Web is a no-op (`useScreenCaptureGuard.web.ts`). Vault copy now clears the clipboard 30 s after a successful copy, like the reference `clearClipboardSoon`, even if the view has hidden; a newer copy replaces the pending clear. It clears only when the clipboard still holds the copied value where that can be read without a prompt (Android; web when `clipboard-read` is already granted), otherwise unconditionally as the reference does, and waits for window focus / app foreground first. iOS keeps its 30 s `expiresAt` and is not read back (avoids the paste banner).

## U-016: Unreachable session restores itself; cold-start offline history stays out of browser storage

E2E OFF-01 (05-Nov-2026): after a cold start offline the session stayed `unreachable` until the user tapped Retry. `watchUnreachable` (src/core/auth/autoRestore.ts) now restores once per watch on the first offline->online or background->foreground transition from `subscribeLifecycle` (browser `online`/visibility, expo-network, AppState), and otherwise on a 3s..30s capped backoff that waits while the device reports offline. The previous inline effect skipped the initial lifecycle report, so it never saw the offline->online transition and only recovered on its timer. Once the session is ready the existing outbox bind/flush drains queued messages in order; client IDs keep it free of duplicates. The unreachable banner now says it reconnects automatically. Showing the cached chat list and history after an offline reload is not done: per U-004 browser history is memory-only and authenticated cold-start offline access needs a separate unlock/revocation design. Enter-to-send is now the tested `enterSends` helper (reference Composer.tsx:368).

## U-017: One SPA route list everywhere; accessible fills and hit areas

E2E DEF-001/DEF-005/DEF-006/DEF-007/STATIC-1 (05-Nov-2026). Every Expo Router page in `src/app` must get `index.html` from the preview server (`scripts/preview-web.cts`), the service worker (`pwa/sw.ts`) and the nginx template; `scripts/pwa-policy.test.cts` now walks `src/app` and fails when any of the three misses a route, so adding a page cannot silently 404 on reload again. The preview starts without `dist/` and answers a plain 503 naming `npm run build:web` instead of crashing. Theme tokens: light `brand` is `#15803d` (5:1 on the light surfaces); white-text badges/chips use new `brandFill`/`dangerFill`/`warningFill` and dark `primary` is `#15803d`, because the reference `#16a34a`/`#22c55e`/`#f87171`/`#f59e0b` give 2.2-3.3:1 under white; avatar hues are the 600/700 steps (`src/contrast.test.ts` guards all of this). The `Sheet` scrim is pointer-only (`focusable={false}`, hidden from assistive tech; Escape/Close remain). List filter chips keep the 28px pill inside a 44px transparent hit area. Mocked-UI assertions spell non-ASCII UI text as `\u` escapes so a mis-decoded file cannot turn them into `?`.

## U-018: Ask Atlas is a JM-server-mediated thread; memory-only cache; Messenger button gated by status

Atlas (JIVO's business AI, spec from the Atlas team 04-Nov-2026) is reached only through JM's own `/api/jm/atlas/` contract (`status/`, `asks/`, `asks/<id>/`); the signed Ed25519 bridge, keys and Atlas URLs stay on the JM server and never reach the client. `src/modules/atlas` holds the framework-free `AtlasThread` (first page, older pages via `before`, send, per-ask polling: 2 s while open for the first 3 min after `created_at`, then 30 s; `with_person` always 30 s; terminal states or `open: false` stop; a failed poll backs off to 30 s; everything pauses while `subscribeLifecycle` reports background/offline and reloads on return) and `AtlasStore` (status with a 60 s TTL, thread cache). Following U-004/U-016 the cache is memory-only and bound to one account: it shows earlier asks offline or when the screen reopens, and is dropped on account change or session loss; it is not written to browser storage or SecureStore. A 503/429/network failure keeps the draft and offers Retry (429 counts down `retry_after`); 400/403 show the server's line. Text only, 4000-character counter (code points), follow-up via `reply_to`, Retry on a failed ask resends it as a new ask. The existing Messenger Atlas button now opens `/atlas` and shows only when `status.enabled`; the "coming soon" sheet is no longer reachable. `/atlas` was added to the SPA route lists (U-017). `JM_ATLAS_USE` was added to `src/config/capabilities.ts`; the server remains the authority.
