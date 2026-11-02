# Continuation validation - 2 November 2026

Universal application changes only. Frontend/backend source and database schemas were not changed. Unified Approvals remains excluded. Authorized live tests used the two accounts supplied by the user; credentials are not saved in project files.

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
