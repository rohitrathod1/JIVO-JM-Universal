# Universal status - 04/05-Nov-2026 full end-to-end test

**Current:** typecheck, lint (0 warnings), 576 vitest tests in 85 files, 8 tooling tests, the production web build and the PWA smoke test PASS on the final source. Mocked browser UI: FAIL at 360 px on a group-info step because the test is out of date (STATIC-6), after passing the composer, offline queue, capture, poll, event, location and lock steps.

Against the isolated backend (8010), these pass:
- Real three-user messaging.
- The offline outbox: exactly once, in order, across flapping networks and two tabs.
- Recovery from a cold start offline (fixed).
- Responsive layout from 320 to 1920 px.
- Deep links on every route (fixed).
- The security probes: API, XSS, redirects and the bundle scan.
- The virtualised 500-chat list (fixed: 50 fps, was 9 fps).

[testing.md](../testing.md) "Full end-to-end test - 04-Nov-2026" is authoritative.

**Deployment readiness: web client READY WITH RISKS; full system NOT READY until the backend items are resolved.**

Backend items (owner: backend, not changed here):
- PERF-02: DB pool of 6 gives HTTP 500 under 5 users on a loaded host.
- PERF-01: on Windows, uvicorn stops accepting connections after a load burst.
- PERF-03: per-member event rendering inside each send.
- M-01: attachments return 404 when no AV scanner marks uploads clean. This is environment-specific.

Open Universal items:
- OFF-02: offline cold start shows no cached chats (by design, U-004).
- SEC-1: no native screenshot protection; needs `expo-screen-capture`.
- Font size: TTF, not woff2.
- Several minor UI/UX items (touch targets, contrast, install prompt timing).

Android native E2E was BLOCKED by host memory and must be re-run.

The `jm_e2e` database on 127.0.0.1:5433 was kept. Drop it when it is no longer needed.

---
# Universal status - 03-Nov-2026 UX parity pass

**Current:** typecheck, lint, 509 vitest tests in 75 files, 7 tooling tests, the production web build, the PWA smoke test and the mocked browser UI run (360/768/1440/844 px plus cross-tab) PASS on the final source. Parity screenshots against the reference (5174) were captured for login, chat list, chat thread, group info, contact profile, profile, notifications, passwords, admin and approvals. Android build, native runtime and real-backend checks were NOT RUN in this pass. [testing.md](../testing.md) is authoritative.

Landed in this pass: reference shell (lucide rail/tab icons, bell menu, rail tooltips, danger badge), Home tiles and admin list, conversation list rows, chat header and options dropdown, new chat/new group dialog, bubble contents (attachments, file chips, reply quote, forwarded, deleted, reaction pill), composer reply/edit bar, profile sections, group info dialog and contact side panel, notifications and alerts, Passwords lock/vault grid/vault page, People, Permission groups, Security, Approvals and the login card.

Known: the shared dev server on port 8090 was started with `CI=1` and does not reload edits; restart it without `CI=1` before visual checks. Open items: FEATURE-PARITY-CHECKLIST.md "Remaining issues".

---
# Universal status - 02-Nov-2026 parity pass

**Current:** typecheck, lint, 507 vitest tests in 75 files, 7 tooling tests, the production web build, the PWA smoke test, the mocked browser UI run (360/768/1440/844 px plus cross-tab) and the x86_64 Android debug build all PASS on the final source of this pass. iOS build is BLOCKED (Windows host). Native runtime, real-backend, load and performance checks were NOT RUN in this pass. [testing.md](../testing.md) is authoritative.

Landed in this pass:
- Unified `/approvals` inbox (FE-023) with navigation entry and waiting badge; no longer excluded.
- Reference shell and tokens (glass levels, radius, shadow, 40px web / 44pt native controls, 16/32px page padding, reference rail and phone bar).
- Group info, Group settings and Add members sub-views; person profile layout; chat header title and phone button; Media/Docs/Links tabs.
- Location picker, date/time fields and composer link preview in the reference layouts.
- Jivo Auth: FE-032 sign-in/token/profile labels, FE-030 required mobile, and FE-033/FE-034/BE-083 (automatic people list, no invitations, central name/email read-only, password change only when advertised).

Open items: see [FEATURE-PARITY-CHECKLIST.md](../FEATURE-PARITY-CHECKLIST.md) "Remaining issues" and testing.md "Not verified".

---

# Previous checkpoint (historical)


Universal has been updated in the existing strict TypeScript Expo/React Native codebase. Frontend and Backend remain read-only references; no schema changes were made. At that time the unified `/approvals` page was excluded by the user's explicit instruction. Existing administration/vault approval actions remain available.

**Current static/unit/tooling and Android build checks pass; responsive browser, cross-tab and production PWA checks pass.** [testing.md](../testing.md) is authoritative for final counts, command outcomes and build status. Source presence, earlier unit passes and a debug APK do not establish full feature/pixel parity or production readiness.

## Landed implementation

- Reference branding/theme tokens, persistent light/dark/system preference, capability-aware landing plus Home, immersive phone chat, compact composer/action menus, delivery ticks and day separators.
- Existing cookie/CSRF/session architecture, real-time protocol and typed module APIs retained. SessionController now checks known expiry on a timer and foreground, invalidating account state and sensitive views.
- Durable-before-visible outgoing messages with stable IDs, persisted capped retry/backoff and account boundaries. Bounded native protected recent history; warm-session network-only fallback and expiry/access-loss guards.
- Locked-chat list and server step-up verification, lock/unlock settings and account-bound memory display gate, with five-minute background relock. Locked content stays out of persistent history snapshots.
- Event create/edit/cancel, custom date/time fields, optional place/meeting/reminder, answers/counts and ICS export; locations with JM map proxy tiles, geolocation/search/reverse and editable send review.
- Shared-media pagination, privacy-filtered OS dialer shortcuts, password/passphrase generator, existing vault/profile/admin flows and foreground notification feedback.
- Android/PWA incoming text/link/file share review for up to five eligible chats, with durable account-bound per-destination retry plans. No automatic send on receiving an intent. iOS receiving disabled pending identifiers/signing.
- Production PWA shell/install/update and original icons; static-only Cache Storage. Browser push opt-in/out/test, account-bound VAPID registration/cleanup and service-worker push/click handling are implemented.

Architecture and implementation tradeoffs: [design.md](../design.md), [decision.md](../decision.md), [feature checklist](../FEATURE-PARITY-CHECKLIST.md), [inventory](MIGRATION-INVENTORY.md), [offline details](OFFLINE-SYNC.md), [incoming sharing](INCOMING-SHARING.md).

## Current observed evidence

- The final x86_64 Android debug build passed in 12m 9s (368 tasks). The APK is 80,881,314 bytes with SHA-256 `1570c5823e45797fa436bda2cd2ad37d0dc1f2b1d44d1754d5b3be6c64681dac`. Evidence: `test-results/android-build.json` and `android-build-final.log`. It includes the multiple-text share MIME filter. The final APK was installed and passed native two-account send/receive with current Metro source; see test-results/native-account-final.json.
- The emulator restored its existing account/session and conversation list after the local backend was restarted using its existing configuration. The backend accepted `/ws/`; logs are in `test-results/backend-continuation.log`. These were read-only app checks, not a fresh real two-user messaging test.
- Native ACTION_SEND synthetic text opened ShareReview, then was discarded without sending. The owned headless emulator was stopped and display size/density overrides reset. Other user services were not stopped for cleanup.
- Current TypeScript and lint checks passed, along with 476 application tests across 69 files and 7 tooling tests. Evidence: `test-results/typecheck-final.log`, `lint-final.log`, `unit-final.log`, `tools-final.log`. The final stable-source browser run passed at 360, 768, 1440 and 844 landscape widths plus cross-tab isolation. Production PWA passed six checks with no page errors; earlier failed attempts are not counted as passes.
- The current production web build passed a real-backend test using two user-authorized accounts on port 8000: both login UIs/CSRF 204, both authenticated WebSocket HELLO messages, actual cross-account MESSAGE_CREATED delivery, reconnect catch-up, offline queue automatic flush, and session/history restoration after reload. Each test message appeared once in backend results; this bounded check is not an unconditional exactly-once guarantee. All three created test messages were removed and both test sessions logged out. Report: `test-results/live-account-smoke.json`, completed at 10:58:11 UTC with no page errors.

- The final APK was reinstalled and passed native composer send plus a second-account API reply appearing live in the native conversation. Both test messages were removed. Current report: test-results/native-account-final.json, completed 11:23:41 UTC. Startup System UI/automation stalls recovered; display overrides were reset and owned emulator/Metro stopped.

## Remaining validation and limitations

- The earlier isolated smoke database lacks `files_upload.discarded_at` and `messenger_eventreminder`; no migration was run. That fixture issue did not block the subsequent authorized two-account check against the user's running backend. Real multi-user event/reminder behavior and a fresh native offline-restart test remain unverified. Current native two-account send/receive passed.
- Native recent-history caching is limited to 10 chats, 40 messages each, 200,000 serialized characters and 30 minutes/session expiry. Cold-start offline authentication is not implemented. Browser history is memory-only; the persistent outgoing queue and pending incoming-share intake are not application-encrypted.
- The documented backend expected-user header guard was not found in the inspected Python source. Client identity checks/coordination remain, but the cross-client account-change race cannot be claimed closed without backend enforcement.
- Physical camera, microphone, GPS, contact/file providers, calendar receivers, biometrics and all OS lifecycle/share-intent combinations need device acceptance. Native receiving is an experimental Expo capability.
- Web push is implemented but actual VAPID/provider delivery and installed Safari behavior are not proven. Native push/passkeys, verified HTTPS app links and final identifiers/signing remain deferred. iOS builds/device tests require authorized macOS/Xcode or cloud infrastructure.
- Exact pixel parity, every gesture, screen-reader behavior, dynamic text and exhaustive module permissions remain incomplete/unverified. No public deployment or store submission occurred.

The earlier checkpoint's `live-smoke.json`, `live-proxy-smoke.json`, `native-smoke.json` and screenshots remain historical artifacts. Do not combine their results with current-source checks into an unqualified pass. Follow [PLATFORM-DEPLOYMENT.md](PLATFORM-DEPLOYMENT.md) and the final [testing.md](../testing.md) before release decisions.
