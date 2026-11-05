# End-to-end test and fix round - 05-Nov-2026

QA re-test after five fix agents (M-01 attachments, PERF-01 backend load, OFF-01 offline recovery, PWA/UI primitives, SEC-1/SEC-2). Tests ran one at a time on the 8 GB host. The isolated backend :8010 (`jm_e2e`) was restarted with the new code, `JM_AV_SCANNER=defender` and the `core.loops:selector_loop_factory` loop. `migrate` applied `access.0007_atlas_capability`, `atlas.0001_initial` and `audit.0006_atlas_stream` to `jm_e2e` only. The browser runs used the production PWA preview on :4176. The dev web :8091 was not started. 8000/8081 and the dev DB were not touched.

## Fixed by QA in this round

- **Backend would not start (new in PERF-01).** `core/loops.py:selector_loop_factory` returned the `SelectorEventLoop` class. uvicorn 0.54 calls a custom `--loop module:attr` with no arguments and expects a loop instance back, so `start-backend.ps1` crashed at boot (`TypeError: BaseSelectorEventLoop.close() missing 'self'`). The function now returns `asyncio.SelectorEventLoop()`. `realtime.tests_fanout` now resolves the factory through uvicorn's own `Config.get_loop_factory()` and runs a coroutine on the loop it returns. The old test only checked for the class, which matched the bug.
- **Backend test isolation.** `access.tests_super_admin_lock.RaceTests` used `serialized_rollback=True`. When another TransactionTestCase ran first (realtime, messenger), restoring the snapshot duplicated `auth_group_name_key` ("Messenger Users"), so the requested suite had 1 error. The flag was removed: the flush re-runs `post_migrate`, which re-syncs the groups. Backend decision BE-100.

## Results

| Check | Before (04-Nov) | After (05-Nov) |
|---|---|---|
| Backend `manage.py check`, `makemigrations --check --dry-run`, ruff on all changed files | - | PASS, no issues, no missing migrations |
| Backend `test messenger realtime notifications core identity access` | - | 714 tests: 1 error (RaceTests, above), 29 skipped. After the fix: `realtime.tests.OriginRuleTests access.tests_super_admin_lock access.tests` OK (23), `realtime.tests_fanout` OK (7), and `test realtime access` OK (117 tests, includes RaceTests after the realtime TransactionTestCases) |
| `npx tsc --noEmit` / `npm run lint` | PASS | PASS / PASS (0 warnings) |
| `npx vitest run` | 576 tests | PASS, 576 tests in 85 files |
| `npm run build:web` | PASS | PASS, shell 5668d847ed2f559e4eb8, 214 files, 4.52 MiB |
| `npm run test:pwa` | PASS | PASS, 214 precached, no page errors, online start 3.2 s, offline start 1.1 s |
| M-01 image attachment, alice -> bob (4176) | FAIL, every `/files/` 404 | PASS. Send 201. The tile image loaded for alice (552 ms) and bob (166 ms), and the viewer opened. All new `/files/` requests return 200. Only the pre-fix upload `...9d9fb3` still returns 409 (owner) / 404 (others), by design (BE-098). |
| M-01 PDF attachment, both users | FAIL | PASS. Export confirmation, then a download of exactly 193/193 bytes for bob and for alice; `?download=1` 200 for both. |
| Enter sends, Shift+Enter newline (real backend) | PASS after fix | PASS. A multi-line message arrived at bob. |
| Reload keeps the open chat | PASS after fix | PASS. `/messenger?conversation=<id>` kept, composer back. |
| Offline K: cold start offline, then online with no user action | Stuck until Retry, then 6.1 s after the first fix | PASS. Banner "Connection unavailable. Reconnecting automatically; ...". Recovered by itself in 1.26 s, 1 copy delivered. |
| Offline J: warm offline history | PASS | PASS |
| Offline B: reload while offline | Shell PASS, no cached chats | Shell PASS, 2/2 queued messages delivered once and in order after reconnect. Cached chats/history still not shown (U-004, by design, open). |
| Deep links /tools /approvals /alerts /group-info /group-edit on 4176 | 404 before DEF-001 | 200 on all, `/nope` 404 |
| 500-chat list (perfheavy, 4176) | 9.4 fps before PERF-04, 50.5 fps after | 73 rows mounted, 1,592 DOM nodes, 45 MB heap, scroll 55 fps (p95 frame 16.8 ms). Filter Groups 19-43 ms, back to All 1.2-1.4 s. Search filter 1.0 s. Cold load: FCP 0.80 s, LCP 1.33 s, CLS 0.25, first row 2.9 s, chat open 151 ms. |
| Websocket reconnect after 5 s offline | 3 ms, 10 requests | 86 ms, 18 requests / 66 KB |
| Load 5 users x 1 msg/s x 15 s (:8010) | 41% HTTP 500, p50 18 s | 0% errors (70/70 201), send p50 81 ms / p95 142 ms, delivery 280/280 p50 111 ms / p95 190 ms |
| Load 50 users x 1 msg/s x 60 s (:8010) | 94.8% errors, server stopped accepting | 0% errors (1,731/1,731 201), but saturated: 17.6 sends/s achieved (1,200 sends skipped at 5 in flight), send p50 8.4 s / p95 9.8 s, delivery p50 67 s (only 1,000 of 6,924 counted). :8010 still accepted connections afterwards: healthz 200 in 50 ms; csrf, login, /me and the websocket HELLO OK. All 50 test sockets later closed with 4408 (idle close; the load script never sends PING), so this is a harness artefact. |
| `npm run test:web` at 360 px (`JM_UI_WIDTH=360`) | FAIL at the 'Group options' step | FAIL at the same step (mocked-ui.cjs:351). Everything before it passes. Log: `test-results/e2e/fixer/test-web-360-0511.log`. |

Evidence: `test-results/e2e/messaging/qa-*.png`, `cmd-results/qa2.txt` and `qa3.txt` (steps kept as `scripts/e2e/messaging/steps/qa-retest.cjs` and `qa-pdf.cjs`); `test-results/e2e/offline/4176-warm-cache.json` and `4176-results.json`; `test-results/e2e/perf/qa-0511/`.

## Still open

- **test:web group settings.** The mocked UI follows the reference (JIVO-JM-Frontend GroupInfo: "Group options" menu, then "Group settings"). Universal now opens "Edit group" as the `/group-edit` page (uncommitted ConversationDetails.tsx/group-edit.tsx, no decision entry). Decide which is intended, then update the UI or mocked-ui.cjs:351-372. 768/1440/844 and cross-tab are still not reached.
- **50-user load.** No errors now, but one process cannot keep up: sends queue at about 8 s and websocket delivery lags about 1 minute. The fan-out lanes (`JM_REALTIME_FANOUT_WORKERS=2`) are the bottleneck (one authorize and one envelope unpack per viewer). Production runs 3 workers with Redis and was not load-tested. The load script should send PING so long runs are not idle-closed (4408).
- OFF-02 / scenario B: no cached chats after an offline reload (U-004 needs an unlock/revocation design).
- Group photo and profile photo still accept an unscanned upload (BE-098 notes). The composer does not show the `upload_not_scanned` detail.
- The client perf script uses `button` for the filter chips, which are `tab`, so its `filterToggleMs` (60 s) is two locator timeouts, not app time. Its long-chat oldest-message detection also returned a sentinel (renderedMessages 0) this run, so long-chat scroll was not re-measured.
- DEF-005 touch targets, the remaining brandFill migration, Inter woff2, StepUp aria-label, iOS copy notice wording: open as listed by the fixers.
- SEC-1/SEC-2 and Android: not verified on a device or emulator in this round.
- Not run: full backend suite after the two QA fixes (only targeted labels), memory over 10 minutes, test:web at 768/1440/844, admin screens.

# Full end-to-end test - 04-Nov-2026 (fixes and re-runs completed 05-Nov-2026)

Seven specialist testers ran in parallel on 04-Nov-2026: static/build, real messaging, offline and cache, responsive UI/UX, performance and load, Android, and security. A fixer/QA pass then fixed the Universal defects and re-ran the checks that had failed, on 04 and 05-Nov.

- Only Universal source was changed. JIVO-JM-Backend and JIVO-JM-Frontend were not edited.
- The user's dev backend (8000), its database, Metro 8081 and the USB phone were not touched.
- No real Jivo accounts or production URLs were used.

## Environment

| Item | Value |
|---|---|
| Backend | Isolated Django/uvicorn on http://127.0.0.1:8010 with database `jm_e2e` on the local PostgreSQL (127.0.0.1:5433). `JM_IDENTITY=local`. No Redis, so the cache and websocket fan-out run in-process. Background tasks run inline. `JM_AV_SCANNER=none`. Development message and vault keys. Link previews and Expo push off. Organisation two-step off. |
| Web | Dev web with a same-origin proxy on http://127.0.0.1:8091 (Metro 8092). Production PWA preview with service worker on http://127.0.0.1:4176 (`scripts/preview-web.cts`). |
| Accounts | Synthetic users alice, bob, carol and dave (Messenger users) and admin, as `<name>@e2e.invalid`. Perf seed `perfheavy`: 500 chats and a 2,000-message chat. |
| Browser | Playwright on Edge (`channel: 'msedge'`) |
| Android | emulator-5554 only (x86_64 debug APK). Port reverses were restored afterwards. |
| Host | 8 GB RAM, 8 cores. During the parallel run on 04-Nov, CPU was at 100% and free RAM was 250-500 MB, so all absolute timings from that day are inflated. |

Scripts are in `scripts/e2e/<area>/` (static, messaging, offline, responsive, perf, android, security, fixer). Artifacts are in `test-results/e2e/<area>/`. The re-runs are in `test-results/e2e/fixer/`.

## Results (final, after fixes)

| Area | Check | Result |
|---|---|---|
| Static | `npm run typecheck` (app, tools, service worker) | PASS |
| Static | `npm run lint` | PASS, 0 errors and 0 warnings. The 3 earlier warnings and 2 lint errors introduced by the first fix round are fixed. |
| Unit | `npm test` (vitest) | PASS, 576 tests in 85 files |
| Unit | `npm run test:tools` | PASS, 8 tests. New test: the service worker, preview server and nginx template serve the app shell for every Expo Router page. |
| Build | `npm run build:web` | PASS, PWA shell 7d60faccd74543663246, 213 files, 4.50 MiB |
| PWA | `npm run test:pwa` | PASS, 213 precached requests, no page errors, online start 7.7 s, offline start 1.4 s |
| Mocked UI | `npm run test:web` (360/768/1440/844 + cross-tab) | FAIL (test drift, not an app defect found so far). At 360 px the suite now passes sign-in, chat list, composer, mentions, offline queue + Discard, message info, edit, capture (Attach -> Camera/Contact, hold-to-record), poll, event/location and chat lock, then stops at mocked-ui.cjs:354 waiting for a 'Group options' button: group info is now a route opened from the header title and the test still follows the old dialog. 768/1440/844 and cross-tab not reached. This run found and fixed one real crash (NEW-1). Log: test-results/e2e/fixer/mocked-ui.log |
| Messaging | Real three-user run: sign-in, chat list, send/receive both ways, order, ticks, reply, edit, reactions, delete for everyone and for me, long Unicode message, forward, mentions, deep link | PASS (04-Nov) |
| Messaging | Enter sends and Shift+Enter adds a newline (M-02) | PASS after fix (`test-results/e2e/fixer/regress.json`) |
| Messaging | The open chat is in the URL and a reload reopens it (M-03) | PASS after fix |
| Messaging | Escape closes conversation search (M-04) | PASS after fix |
| Messaging | Typing indicator is gone 7 s after the composer is emptied (M-05) | PASS after fix |
| Messaging | Image attachments open (M-01) | Download FAIL, caused by the backend/environment: every `/api/jm/files/<id>/` returns 404 (see open defects). Client fix PASS: the tile now shows an icon instead of a blank box. |
| Messaging | Group create/add/remove/leave, polls, events, notification bell contents | NOT RUN against the real backend. Polls and events are covered by the mocked UI suite. |
| Offline + cache | Offline send is queued durably and delivered once, in order (5 messages). Also: a new page with a queue, 10 sends on a flapping network, lost-ACK idempotency, two tabs sharing the outbox, automatic retry after a 503, "Not sent" with Retry/Discard after a 400, a queued image | PASS (04-Nov). 0 duplicates, 0 out of order. |
| Offline + cache | A queued bubble shows "Waiting for network · sends automatically" and Discard. The banner reads "Offline. Messages will send when connected." | PASS after fix |
| Offline + cache | Warm offline history ("Offline: showing recently synchronized messages.") | PASS |
| Offline + cache | Cold start offline, then back online with no user action (OFF-01) | PASS after fix. The app recovered by itself in 6.1 s and the queued message arrived once. Before the fix it stayed stuck until the user pressed Retry twice. |
| Offline + cache | A reload or cold start while offline shows cached chats (OFF-02) | FAIL, by design: decision U-004 keeps web history in memory only and requires session validation. Open. |
| Responsive | No horizontal overflow or clipped app text at 320-1920 px, 640/900 px heights, light and dark | PASS (390 screenshots) |
| Responsive | Deep link or reload of /tools, /approvals, /alerts, /group-info, /group-edit (DEF-001) | PASS after fix. All return 200 on 4176; an unknown path still returns 404. |
| Responsive | Keyboard: sign-in tab order, Enter submits, visible focus, install-dialog focus trap and Escape | PASS |
| Responsive | Touch targets of at least 44 px on phones (DEF-005) and WCAG AA contrast for brand green, badges and avatars (DEF-006) | FAIL, open, minor. Sizes and colours match the reference. |
| Responsive | Admin screens as the admin user | NOT RUN (the preview was down at the time) |
| Performance | Bundle: initial JS 1.8 MB raw / about 480 KB gzip; Inter TTF fonts 1.34 MB | PARTIAL. Fonts are still open. The nginx example now gzips JS, CSS, JSON and TTF. |
| Performance | 500-chat list (PERF-04) | PASS after fix. Now: 73 rows mounted, 1,527 DOM nodes, 46 MB heap, scrolling at 50.5 fps (p95 frame 16.9 ms). Before: 501 rows, 8,768 nodes, 132 MB, 9.4 fps (p95 600 ms). |
| Performance | 2,000-message chat | PASS. Scrolled up to the oldest message at 59 fps (p95 16.9 ms) with 218 DOM nodes. |
| Performance | Cold load on 4176 (quiet host) | PASS. TTFB 20 ms, FCP 1.04 s, LCP 2.6 s, CLS 0.25. First chat row at 8.9 s (waiting on the list API); opening a chat took 254 ms. |
| Performance | Websocket reconnect after 5 s offline | PASS. Reopened in 3 ms; resync took 10 requests / 9 KB (was 20 / 68 KB). |
| Performance | Memory over 10 minutes | NOT RUN |
| Load | 5 users x 1 msg/s (04-Nov, loaded host) | FAIL. 41% HTTP 500 (database pool exhausted), p50 18 s. |
| Load | 5 users x 1 msg/s (05-Nov, quiet host) | No errors: 70/70 sends returned 201 and 280/280 deliveries arrived. Slow: send p50 2.6 s / p95 3.6 s, delivery p50 2.2 s, only 1.3 sends/s achieved. |
| Load | 50 users x 1 msg/s with websockets | FAIL (backend). Stopped at 43 s with 94.8% errors; the backend then stopped accepting connections. Not re-run. |
| Android | Native E2E on emulator-5554 | BLOCKED. The host ran out of memory and the system hit an ANR. The app only reached the 8010 sign-in screen. |
| Security | API: CSRF, Origin/CORS, cross-site websocket (closed with 4403), admin capability checks, chat and vault isolation, logout revocation | PASS 21/21 |
| Security | XSS in messages and file names; open redirect via `login?next`; crafted invite/reset links; bundle secret scan | PASS: XSS 10/10, open redirect 9/9, links 13/13, 0 secrets and 0 source maps in the bundle |
| Security | Sign-out clears the outbox, drafts and caches; another user on the same browser sees nothing | PASS. The control step was only partly confirmed. |
| Security | Service worker leaking cached data between users | PASS by code review. The dynamic run was blocked on 04-Nov. |
| Security | Native screenshot protection (SEC-1); vault clipboard auto-clear (SEC-2) | FAIL, open |

## Key metrics

- API + websocket delivery of 20 messages (04-Nov): 20/20 in order, p50 825 ms, p95 2,447 ms.
- Offline: 0 duplicates and 0 out-of-order messages across about 27 offline or flapping-network sends. Cold-start recovery took 6.1 s after the fix.
- Client: the chat list is virtualised (73 of 501 rows mounted). List scrolling runs at 50.5 fps and long-chat scrolling at 59 fps. Cold LCP on the production preview is 2.6 s.
- Server: one send takes 449 ms in process (events.build 355 ms, 48 SQL statements). The 5-user load had 0 errors at p50 2.6 s on a quiet host, but 41% errors on a loaded host. The 50-user load collapses.

## Defects fixed (Universal)

| ID | Fix | Files |
|---|---|---|
| STATIC-1, STATIC-2 | A queued message shows "Waiting for network · sends automatically" with a Discard button, as in the reference. The test asserts that text. | `src/components/PendingMessages.tsx`, `mocked-ui.cjs` |
| STATIC-3 | The capture test follows the reference paths: Attach -> Camera, Contact, and hold-to-record. | `capture-interactions.cjs`, `mocked-ui.cjs` |
| STATIC-4 | Removed the 3 lint warnings and 2 later lint errors (impure `Date.now` in a render path, an unescaped `'`). | `outboxController.ts`, `queuedMedia.native.test.ts`, `PendingMessages.tsx`, `Messenger.tsx` |
| STATIC-5 | The dev-server start timeout is configurable (`JM_DEV_SERVER_TIMEOUT_S`, default 300 s), each request has its own timeout, and the bundle is warmed before the first `page.goto`. | `run-mocked-ui.cjs` |
| NEW-1 | test:web found a crash in the dev build: the thread threw "Changing onViewableItemsChanged on the fly is not supported". The handler now keeps the same identity. | `src/components/ConversationWorkspace.tsx` |
| NEW-2 | The mocked UI helpers used the old voice-button and "Message tools" names, and looked for Lock chat and Group info in the header menu. They now use the Attach menu and the chat header title. | `mocked-ui.cjs`, `scripts/special-message-ui.cjs` |
| M-01 (client) | The image tile shows an image icon when the URL is missing or fails to load, never a blank box. | `src/components/MessagePresentation.tsx` |
| M-02 | Enter sends on desktop web and Shift+Enter adds a newline. Coarse pointers (touch) keep Enter as a newline. | `src/components/ChatComposer.tsx` |
| M-03 | Selecting a chat writes `?conversation=<id>` to the URL, so a reload reopens it. | `src/components/ConversationWorkspace.tsx` |
| M-04 | Escape closes every web Sheet, including conversation search. | `src/components/Sheet.tsx` |
| M-05 | A typing-stop frame is sent when the composer empties or the chat closes. | `src/modules/messenger/useConversationLive.ts` |
| M-06, DEF-008 | "Load earlier messages" is a compact centred control, not a full-width bar over the first bubble. | `src/components/ConversationWorkspace.tsx` |
| OFF-01, DEF-003 | When the session restore cannot reach the server, it retries by itself when the device comes back online or to the foreground, and on a capped backoff. | `src/core/auth/Session.tsx` |
| OFF-03 | The offline status takes priority over a network error, so the banner reads "Offline. Messages will send when connected." | `src/components/ConnectionStatus.tsx` |
| OFF-04 | Cached rows of chats that have history show "Preview unavailable" instead of "No messages yet". | `src/components/ConversationWorkspace.tsx` |
| DEF-001 | Every router page is in the SPA route allowlist of the preview server, the service worker and the nginx example. | `scripts/preview-web.cts`, `pwa/sw.ts`, `deploy/nginx-universal.conf.example`, `scripts/pwa-policy.test.cts` |
| DEF-004 | An invalid chat deep link shows "This chat isn't available..." and the chat list stays visible. | `src/components/Messenger.tsx` |
| DEF-009 | A non-admin opening /admin sees a styled empty state with "Back to home". | `src/components/AdminPanel.tsx` |
| DEF-010, PERF-06 | The preview server answers 503 while `dist/` is being rebuilt instead of crashing. | `scripts/preview-web.cts` |
| PERF-04 | The chat list is virtualised (FlatList, 20-row batches). | `src/components/ConversationWorkspace.tsx` |
| PERF-05 (part) | The nginx example enables gzip for JS, CSS, JSON, the manifest, SVG and TTF. | `deploy/nginx-universal.conf.example` |

## Defects open

| ID | Severity | Owner | Title |
|---|---|---|---|
| PERF-01 | blocker | backend/ops | After a load burst, uvicorn on Windows (Proactor event loop) stops accepting connections ("Accept failed", WinError 64). The process stays alive but no longer listens. Fix: deploy on Linux, or run under a supervisor that restarts it on a failed health check. |
| PERF-02 | blocker | backend | Sends return HTTP 500 "couldn't get a connection after 10.00 sec" because `JM_DB_POOL_MAX` defaults to 6 (`config/settings.py:115-121`). Fix: size the pool to the thread pool, return 503/429 instead of 500, and run several workers (which needs Redis). |
| PERF-03 | major | backend | Each send renders and authorises the event for every member inside the request (`messenger/events.py:42`): 355 of 449 ms and 48 SQL statements for 5 members. Fix: move the fan-out to a worker. |
| M-01 | major | backend/environment | Every attachment returns 404 from `/api/jm/files/<id>/` in this environment. `files/access.py` `can_read_upload` requires `scan_status == CLEAN`, and `JM_AV_SCANNER=none` leaves uploads `NOT_SCANNED`. In production a scanner runs, so this is expected and safe there. Test environments need a scanner (or a development "clean" stub) to exercise attachments. Re-test attachments end to end once one is configured. |
| OFF-02 | major | universal (design) | A reload or cold start while offline shows only the banner. Web history is kept in memory only, and the outbox loads after `/me` succeeds (decision U-004). |
| SEC-1 | major | universal (needs `expo-screen-capture`, a new package) | Native has no FLAG_SECURE and no screenshot or recents protection. |
| AND-ENV-01 | blocker (environment) | test infra | Native E2E could not run because the host ran out of memory. Re-run on a machine with more RAM, or without parallel testers. |
| PERF-05 (rest) | minor | universal | First load downloads 1.34 MB of Inter TTF fonts. Ship woff2 subsets. |
| OFF-05 | minor | universal | A reaction or edit that fails offline shows no message about that action. |
| OFF-06 | minor | universal | A failing queued upload holds back later texts in all chats, because the queue keeps strict global order. |
| M-07 | minor | universal | After a backend outage the open chat may miss a message until the next event arrives, and the list spinner can stay on. |
| M-08 | minor | universal | The install-app dialog opens over the chat list shortly after sign-in. |
| DEF-002 | minor | universal | Icons are PNG images and can show as blank slots while they load. |
| DEF-005, DEF-006 | minor | universal/design | Some phone touch targets are under 44 px, and brand green, badges and avatar initials are below WCAG AA contrast. Both match the reference. |
| DEF-007 | minor | universal | The Passwords step-up sheet has an unnamed full-viewport backdrop, and Cancel is styled as the primary button. |
| PERF-07, PERF-08, PERF-09 | minor | universal | Three issues: the heap churns about 2 MB/s while idle; an overlay intercepts pointer events on list row text; the list and receipts are refetched on many events. |
| STATIC-3 (rest) | minor | universal | `CapturePanel.tsx` is no longer imported anywhere, so the vCard import flow cannot be reached. Delete the file or link it again. |
| SEC-2, SEC-3 | minor | universal | Copied vault secrets are not auto-cleared on web or Android (a documented departure from the reference). The native session cookie lives in the OS cookie store, not SecureStore. |
| STATIC-6 | major | universal (tests) | `mocked-ui.cjs` still drives the old group-info dialog ("Group options", "Close conversation details"); update it for the /group-info route, then run 768/1440/844 and cross-tab |
| AND-NOTE-02 | minor | universal | `scripts/native-smoke.cts` and `native-account-smoke.cts` hardcode ports 8100 and 8000. |

Note: the "filter toggle 60.9 s" metric from 04-Nov is a script artifact. The filter chips have `role="tab"`, but the probe looked for buttons, so it waited out two 30 s timeouts. The re-run measured the same 60 s for the same reason.

## Environment left behind

All isolated services were stopped: the 8010 backend, the 8091/8092 dev web and the 4176 preview. The `jm_e2e` database on 127.0.0.1:5433 was kept, with its synthetic users and messages. Drop it when you no longer need it (`DROP DATABASE jm_e2e;`). Uploaded test files are in the scratchpad `e2e\media` folder.

---
# Validation - 03-Nov-2026 UX parity pass

Universal changes only; JIVO-JM-Frontend and JIVO-JM-Backend were read only. Six area engineers (shell, chats, thread, info, inbox/vault, admin) restyled their screens against the reference; QA then wired the cross-area items, fixed tests and ran everything below on 03-Nov-2026 against the final source. Mocks/fakes only: no real accounts, messages or production services.

| Command | Result |
|---|---|
| `npx tsc --noEmit`, `npm run typecheck` (app, tools, service worker) | PASS, no errors |
| `npm run lint` (expo lint) | PASS, 0 errors, 0 warnings (QA fixed import/first warnings in `SpecialMessage.tsx`, a BOM in `VaultGate.tsx` and unused imports) |
| `npm test` (vitest) | PASS, 509 tests in 75 files |
| `npm run test:tools` | PASS, 7 tests |
| `npm run build:web` | PASS, PWA shell 01853fef6b358b4a7be4, 179 files, 4.22 MiB, `dist/` |
| `npm run test:pwa` | PASS, 179 precached requests, no page errors |
| `npm run test:web` (mocked browser UI + cross-tab) | PASS at 360, 768, 1440 and 844 px plus cross-tab, after 5 failing runs fixed in `mocked-ui.cjs` (see below) |
| `node scripts/ui-parity.cjs` with `JM_UI_URL=http://localhost:8090` | PASS (12 captures, no page errors, no overflow), but 8090 serves a STALE bundle: it was started with `CI=1`, so Metro does not watch files. Copies kept in `test-results/ui-parity-8090/` |
| `node scripts/ui-parity.cjs` with `JM_UI_URL=http://localhost:8099` (fresh watching server started and stopped by QA) | PASS, 12 captures, no page errors, no overflow |
| `node scripts/parity/{shell,chats,thread,info,inbox-vault,admin}.cjs` against 5174 and 8099 | All exited 0; PNGs in `test-results/parity/<area>/` |
| Android build | NOT RUN (not requested; all changes are JS/TS plus PNG assets that Metro serves) |
| Native runtime, real backend, load, performance, security scans | NOT RUN this pass |

## Fixed by QA in this pass

- Message bubbles now use the thread engineer's components: attachments (`MessageAttachments`: image tiles, media rows, file chips) above the text, `DeletedText`, the Forwarded label, the reply quote with jump-to-seq, and the reaction pill on the bubble edge. The time stays inline on the last text line also with reactions or attachments. Own-bubble time no longer overlaps the last word (the meta spacer was narrower than time + ticks). The reply/edit bar above the composer is `ComposerContext`.
- Image, audio and video exports moved to the message actions sheet ('Export attachment <name>'), since the bubbles no longer show export buttons (reference).
- Lucide icons replace text glyphs: Forward, Ban, Download, Play, CornerUpLeft, Pencil, X, ExternalLink, ChevronRight (breadcrumbs), LockKeyhole (Passwords lock), FolderPlus/Pencil/Archive (vault), Fingerprint/Laptop (profile), Crown/Shield (group roles), Building2 (companies), alert severity icons (Info / AlertTriangle / Megaphone).
- `Sheet` gained an optional reference Dialog header (`title`, X close, divider), a `wide` 672px size and a `side` 384px right panel (full screen below 768px). The overlay is slate-900/30 with blur on web. Group info uses the wide dialog; contact Profile uses the side panel; the bottom Close buttons are gone (the X keeps 'Close conversation details' / 'Close profile').
- Chat header title: 12px gap, 4px vertical padding, 8px radius, hover tint, 12/16 subtitle. Phone ThemeToggle: 20px icon in a 36px round hover button.
- Profile 'This device' section now holds Install app and the app lock as rows (web and native), as in the reference.
- `mocked-ui.cjs`: desktop notifications open through the rail bell menu ('View all notifications & settings'); 'No notifications.' empty text; deleted text 'This message was deleted' / 'You deleted this message'; audio export through the message actions sheet; vault rename asserts the saved name (a personal vault is titled 'My vault'); admin sections through the rail links (desktop) or the 'Administration' tablist (phone); legacy approvals tab through `/admin?tab=approvals`. No assertion was removed.

## Not verified

- Native Android rendering of the restyled screens (the APK was not launched).
- Dark mode at every width for every area; the person detail page, entry detail page, Companies and the legacy admin approvals tab were not restyled.

---
# Validation - 02-Nov-2026 parity pass

Universal changes only; Frontend and Backend were read only. The unified Approvals inbox is now in scope (the user's 02-Nov-2026 exact-parity request). All checks below ran on 02-Nov-2026 against the final source of this pass, with mocks/fakes only: no real accounts, messages or production services were used in this pass.

| Command | Result |
|---|---|
| `npx tsc --noEmit`, `npm run typecheck` (app, tools, service worker) | PASS, no errors |
| `npm run lint` (expo lint) | PASS, 0 errors, 0 warnings (first run: 1 error in `useWaitingApprovals.ts`, set-state-in-effect, fixed) |
| `npm test` (vitest) | PASS, 507 tests in 75 files |
| `npm run test:tools` | PASS, 7 tests |
| `npm run build:web` | PASS, PWA shell 05bf1a08af03b20a4bc5, 85 files, 4.02 MiB, `dist/` |
| `npm run test:pwa` | PASS, 85 precached requests, no page errors (online start 1741 ms, offline start 943 ms on the first run) |
| `npm run test:web` (mocked browser UI + cross-tab) | PASS at 360, 768, 1440 and 844 px plus cross-tab, after 4 failing runs that were fixed (see below). Log: `test-results/mocked-ui-2026-11-02.log` |
| `npm run android:build` (x86_64 debug) | PASS, BUILD SUCCESSFUL in 58s (incremental, 368 tasks, 21 executed). APK `android/app/build/outputs/apk/debug/app-debug.apk`, 80,881,314 bytes, SHA-256 1570c5823e45797fa436bda2cd2ad37d0dc1f2b1d44d1754d5b3be6c64681dac. Log: `test-results/android-build-2026-11-02.log` |
| iOS build | BLOCKED: needs macOS with Xcode; this machine is Windows |
| Native runtime on emulator/device | NOT RUN this pass (the debug APK loads JS from Metro; it was not installed or launched) |
| Real-backend, load, performance, security scans | NOT RUN this pass |

## Failures found and fixed in this pass

- Lint: `useWaitingApprovals` called setState synchronously in an effect; the disabled state is now masked in the return value.
- The Approvals navigation entry had been dropped when the shell navigation was rewritten (its badge was moved onto Admin). It is restored in `shellLinks` (rail and phone bar, after Passwords), with the badge back on Approvals; `shellLayout.test.ts` updated.
- Location action rows were named "Send this location, <address>"; action rows are now named by their action, with the status line as the accessibility hint (result rows keep name and address).
- `mocked-ui.cjs` updated for the new UI, without weakening assertions: the profile mock has a valid mobile number (FE-030), group settings are opened through 'Group options' -> 'Group settings', 'Save group information' is asserted disabled before an edit and after a save, member actions go through 'Actions for <name>', senders are saved with 'Save permissions', the shared Docs control is asserted as a tab, and a new Approvals scenario checks the badge, the confirmation step, the approve POST and the empty state. `/api/jm/approvals/` and the approve action are mocked.

## Jivo Auth alignment (FE-033, FE-034, BE-083)

Unit coverage in `src/core/auth/identityModel.test.ts`: `password_change` / `name_change` parsing, and `peopleStatuses` (no Invited filter in Jivo mode). The browser mock answers only local identity, so Jivo-mode screens are not browser-tested.

## New or changed test files

`src/modules/approvals/model.test.ts`, `src/modules/messenger/conversationInfo.test.ts`, `src/modules/messenger/location/format.test.ts`, `src/modules/messenger/composerPreview.test.ts`, `src/shared/shellLayout.test.ts`, `src/core/auth/identityModel.test.ts`, `mocked-ui.cjs`.

## Not verified

Visual pixel comparison against the Frontend at 390/768/1440 in light and dark (the mocked run checks behaviour, overflow and saves screenshots under `test-results/`, but no side-by-side comparison was made); Android and iOS runtime; Jivo-mode browser flows; native passkeys and push.

---

# Previous checkpoint (historical, earlier on 2 November 2026)


Universal application changes only. Frontend/backend source and database schemas were not changed. Unified Approvals was excluded at that time. Authorized live tests used the two accounts supplied by the user; credentials are not saved in project files.

## Verified results

| Check | Result |
|---|---|
| TypeScript: app, tools, service worker | PASS |
| Source ESLint, zero warnings | PASS |
| Vitest | 476 tests across 69 files PASS |
| Proxy/PWA tooling policy tests | 7 PASS |
| Production web export | PASS; build d0009cc29e9f8237f7cf, 82 files, 4,167,713 bytes |
| Final Android x86_64 debug build | SUCCESS, 12m 9s, 368 tasks |
| Native runtime | Final APK installed; expected account restored; native composer send and second-account reply passed against real backend; both test messages removed |
| Real two-account web integration | PASS against the user's running backend on port 8000 |
| Responsive browser and PWA regression | PASS: 360, 768, 1440 and 844 landscape; cross-tab isolation; six production PWA checks; no runtime exceptions |

The APK is android/app/build/outputs/apk/debug/app-debug.apk, 80,881,314 bytes; SHA-256 1570c5823e45797fa436bda2cd2ad37d0dc1f2b1d44d1754d5b3be6c64681dac. The final native configuration adds multiple-text sharing and was installed for the final real-backend native check. Later TypeScript fixes load through Metro and do not require another native configuration build. This is a debug build, not a signed release.

## Real backend verification

scripts/live-account-smoke.cts ran against the production export with two separate browser contexts and the supplied accounts. The final run finished at 10:58:11 UTC:

- Both real login forms succeeded; CSRF GET 204 initialized the cookie correctly.
- Both authenticated WebSockets received HELLO. An app-composed message reached the other account through a real MESSAGE_CREATED event.
- Disconnecting one browser, sending from the other, and reconnecting recovered the missed message. A message composed offline automatically left the persistent queue after reconnect.
- Backend history contained exactly one copy of each test message. Reload restored the session and conversation.
- All three final-run test messages were deleted through their authors' APIs, and both final test sessions signed out. Three labeled messages left by an interrupted test were also removed. No unrelated messages were changed.
- No browser runtime exceptions occurred. Credentials, cookies and tokens are excluded from the JSON report.

Evidence: test-results/live-account-smoke.json and .log. Earlier attempts identified production install-prompt handling and duplicate chat-preview test selectors; the harness now dismisses the real prompt and scopes message assertions to history. Those failures are not counted as passing runs. The old isolated test database still lacks fields, but that fixture limitation no longer blocks the current authorized live check; no migrations were run.

## Browser and PWA evidence

The final browser run passed the four layouts plus cross-tab queue persistence/account isolation, with no unexpected external requests or runtime exceptions. Event/location creation/edit/calendar/cancel, locked-chat concealment, incoming-share partial retry, vault and administration fixtures passed. The production PWA run finished after those checks at approximately 11:08 UTC: public shell/install assets, multipart intake bounds/overwrite rejection, private API cache exclusion, offline public shell reload, waiting update and explicit activation all passed. Online startup measured 2,723 ms and offline reload 1,329 ms in the isolated fixture; these are local samples, not performance guarantees. Reports: test-results/web-final.log and pwa-smoke.json.

## Final native check

At 11:23:41 UTC, the final installed APK with current Metro source passed expected-account/profile restoration, a native composer message received once by the second account, and a reply from that account appearing in the open native conversation without a manual refresh. The counterpart used the real authenticated backend API. Both test messages were removed, temporary API sessions signed out, and the existing native login preserved. Evidence: test-results/native-account-final.json. Android System UI and UiAutomation stalled during startup; choosing Wait recovered them. Native display overrides were reset, and the owned emulator and Metro stopped after verification.

## Privacy and retry fixes

Account-level chat-lock events now evict even unselected histories. Known locks reject stale writes. RESYNC invalidates cached history/list generations so older requests cannot restore content before fresh access checks. Native incoming sharing preserves an unfinished plan, its files and stable message/upload IDs when another OS intent arrives; clearing the old review does not erase the newer intent. Thirteen added regressions cover these fixes.

## Remaining acceptance work

Native push/passkeys, verified HTTPS app links, iOS build/signing and store release remain deferred under the agreed local-development scope. External browser-push delivery still needs a configured provider and device validation. Physical camera/GPS/biometrics/calendar/file-provider tests remain unverified. Current native send/receive passed; native offline-restart acceptance is separate from the passing browser reconnect/queue check.

Visual comparison covers light/dark phone and desktop screenshots, but exact parity remains partial: several menu, bubble, composer and login details differ. See [UI evidence](docs/UI-PARITY-2026-11-02.md).

Native recent history is bounded to 10 chats x 40 messages, 30 minutes or known session expiry. Cold startup needs session validation. Web history is memory-only; browser outbox and incoming-share IndexedDB are not application-encrypted. Vault secrets do not enter the PWA shell cache. Client coordination cannot eliminate arbitrary cross-client cookie races without backend enforcement of the documented expected-account guard.

The emulator experienced a System UI stall under memory pressure and a development linking warning during activity recreation. Checks recovered after reload. Display overrides were restored and the owned emulator/Metro stopped. No duplicate Router setup was found in application source.

## Reproduction and services

Run typecheck, lint, test, test:tools, test:web, build:web, and test:pwa with npm.cmd. Commands and platform setup are in [README](README.md). The live-account script reads JM_SMOKE_EMAIL, JM_SMOKE_PASSWORD, optional second-account variables and JM_SMOKE_URL from process environment; use only authorized test accounts.

The final preview is left at http://127.0.0.1:4175, connected to the user's existing backend on 8000. Temporary preview4176/backend5000 helpers were stopped. The user's backend and database services remain running. No public deployment or store submission occurred.

Generated logs/reports/screenshots are under ignored test-results/. See [feature checklist](FEATURE-PARITY-CHECKLIST.md). The [initial cycle report](docs/archive/testing-initial-2026-11-02.md) is historical.

## 03-Nov-2026: side-by-side visual pass

`scripts/ui-parity.cjs` now captures both apps with identical synthetic data (no backend) at 390, 768 and 1440 px in
light and dark: sign-in, chat list, open chat (36 screenshots, `test-results/ui-parity/`, pairs `pair-*.png`). The first
capture showed differences in the rail, phone tab bar, chat list header, filters, tablet split, empty pane, bubbles,
composer and sign-in; they were fixed (shell/list, chat, sign-in) and the recapture matches the reference closely.

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npx vitest run` | PASS, 509 tests in 75 files |
| `npm run test:tools` | PASS, 7 tests |
| `npm run build:web` | PASS (PWA shell, 88 files) |
| `npm run test:pwa` | PASS, 88 precached requests, no page errors |
| `npm run test:web` | PASS at 360, 768, 1440 and 844x390, plus cross-tab (after updating labels: "Sign in", "Email", rail "Notifications"/"People", phone "Inbox", account menu by holding Profile for Approvals, Administration and Sign out; the approvals badge is checked on the rail only, as in the reference) |
| `node scripts/ui-parity.cjs` | PASS, 12 app/theme/width runs, no page errors, no horizontal overflow |
| Android: `npm run android:launch` on emulator Medium_Phone | App installs, loads from Metro, reaches the local backend and shows the Jivo-mode sign-in. Signed-in screens not yet checked (needs a sign-in on the emulator). |

Still different: some icons are stand-ins (refresh, ClipboardCheck, ShieldCheck, LockKeyhole, MessagesSquare,
Megaphone); the rail bell opens Notifications instead of a dropdown; the mic opens the capture sheet instead of
hold-to-record; reactions show inside the bubble; attachment/poll/contact cards and the reply strip are not restyled.
