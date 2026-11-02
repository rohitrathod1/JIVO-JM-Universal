# Universal status - 2 November 2026 continuation

Universal has been updated in the existing strict TypeScript Expo/React Native codebase. Frontend and Backend remain read-only references; no schema changes were made. The unified `/approvals` page remains excluded by the user's explicit instruction. Existing administration/vault approval actions remain available.

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
