# Universal status - 2 November 2026

Scope: `JIVO-JM-Universal` only. The mistaken `/approvals` request was withdrawn. No frontend/backend source or configuration change is required by this checkpoint.

## Verified

- All application code under `src/` is strict TypeScript. Application/tooling typechecks, warning-free lint, 291 application unit tests across 48 files, and two Node/tsx tooling tests passed. The final combined verification also passed all four Edge layouts (360 x 1000, 768 x 1000, 1440 x 1000 and 844 x 390) and cross-tab/session/outbox checks after the native fixes. Evidence: `test-results/verification-latest.json`.
- Real browser sign-in in Universal and the original frontend against an isolated local Django test database. Messages passed in both directions, and Universal caught up after an offline/reconnect cycle. No browser runtime errors were observed. Evidence: `test-results/live-smoke.json`.
- The local proxy passed CSRF cookie initialization (204), cookie sign-in, authenticated WebSocket HELLO, rejection of a foreign socket origin, and sign-out. Evidence: `test-results/live-proxy-smoke.json`.
- The x86_64 Android debug APK built and installed successfully on the Medium_Phone emulator. Windows CMake paths are shortened using an ignored cache and a temporary drive alias; the alias is removed on exit. Native generation is reused when configuration/dependencies are unchanged.
- Android sign-in and cookie-session restoration worked. A native send reached the other account exactly once; an incoming message appeared without refreshing. With API connectivity removed, a queued message survived process termination and was delivered exactly once after reconnect/restart. Sign-out returned to login. Evidence: `test-results/native-smoke.json`, `native-live-chat.png`, `native-offline-queue.png`, and `native-restored-queue.png`.
- No React Native/Android fatal runtime errors were found in the final app process. The native test caught and fixed an unsupported accessibility role and an overflowing phone conversation layout. Native phones now keep the composer above navigation and use an options menu for secondary actions.
- SDK package compatibility passed. The production dependency audit reports 25 moderate advisories, zero high and zero critical. See `DEPENDENCY-TRIAGE.md`.

Real API checks used synthetic users and a separate test database. Application accounts and the normal database were not used for these tests. Other ongoing frontend/backend work is outside this change.

## Implemented

WebSocket handshake timeout, backoff, heartbeat cleanup, stale callback guards and connection status; network/app-state recovery; REST outbox retries; chunked native protected outbox storage; native device app lock and secret clipboard handling; global unread/alert presentation and preference-aware foreground feedback; per-conversation drafts; contact profiles; poll voters; audio seek/speed and native authenticated media headers; image zoom/pan and loaded-photo navigation; cursor-aware mentions and link previews; TypeScript local web proxy; SDK package alignment; Windows build/launch commands; Metro cache exclusions; obsolete-file cleanup.

135 obsolete scripts, logs, audit snapshots and template entry points were removed. `docs/cleanup-2026-11-02.json` records them; a recovery archive is in `../.maintenance-backups/universal-cleanup-2026-11-02.zip`.

## Remaining scope and validation

- Native passkeys, verified HTTPS app links, background push and release identifiers/signing remain deferred by agreement until the domain and app identifiers are chosen. Local custom-scheme conversation links were exercised in the emulator.
- iOS builds and device checks require macOS/Xcode. Signed release builds and real Android devices remain unverified. The debug APK requires Metro.
- Real-device file picking, recording, contacts, media playback, export receivers, device authentication, font scaling and broader OS/lifecycle behavior still need testing. Emulator messaging success does not prove every native integration.
- Image navigation covers loaded conversation messages. Complete media-history paging, exact skeleton/blurhash visuals and all swipe/pull gestures are not identical to the original frontend.
- A browser service-worker/offline installation package is not implemented.
- Automatic clipboard clearing is not implemented. Queued sends use protected native storage; unsent composer text remains in session memory, like the original frontend.
- Client session/owner checks protect the outbox. Without backend changes, another client changing a shared session between identity validation and a queued mutation remains a server-side account-binding limitation.

Local Android real-time messaging is verified. Full feature/visual parity across Android, iOS and the original frontend, and production release readiness, are not yet claimed.
