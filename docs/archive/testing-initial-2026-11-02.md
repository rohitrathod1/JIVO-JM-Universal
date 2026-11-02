# Initial migration cycle: test report

Scope: Universal only, 2 November 2026, hard stop 09:12 UTC. Reference frontend/backend files and database schemas were not edited. Unified Approvals is excluded by the user. See [design.md](design.md), [decision.md](decision.md), [feature checklist](FEATURE-PARITY-CHECKLIST.md), and [deployment instructions](docs/PLATFORM-DEPLOYMENT.md).

**Status: NEEDS REVIEW / not production-ready.** The first full browser regression failed on a real duplicate-key defect in group details. The sibling key was corrected; a fresh browser retest progressed beyond the fixed group flow but failed an obsolete dark-text color expectation; it is recorded separately in `test-results/web-cycle-retest.log`. Do not treat the earlier verification JSON failure as a passing suite. The final integrated verification results are recorded below. Final production web build: 64 shell files, 3,722,694 bytes (3.55 MiB); public shell PWA tests passed on this final build with zero page errors at 09:10 UTC on final build `f087120c16c6e4d623ac`. Historical reports in `docs/STATUS.md` and earlier `test-results` files must not be substituted for current results.

## Results and evidence

| Stage | Current result | Evidence / scope |
|---|---|---|
| TypeScript / lint | PASS | App, Node tooling and service-worker configurations plus zero-warning source lint; `test-results/verification-latest.json` |
| SDK compatibility | PASS | `test-results/dependency-check-cycle.log`: dependencies up to date; no runtime dependency added |
| Android | BLOCKED by initial timebox | New branded native build reached CMake compilation without errors but was stopped before completion. Expo regeneration removed the historical APK, so **no current APK exists**; `test-results/android-cycle.log`. Prior APK evidence is historical, not a current build pass. |
| iOS | BLOCKED | Windows host, no macOS/Xcode, final bundle identifier or signing access; no iOS build run |
| Web production | PASS final export 09:09 UTC | `test-results/web-build.json`; final output `dist/` |
| Unit | PASS | 337 tests across 56 files, 6.14 seconds; `test-results/unit-latest.log`. Seven Node proxy/PWA policy tests also passed. |
| Integration | Client integration tests PASS; complete browser regression FAIL | Persistent queue, account/session boundaries, history and API contract tests; mocked responses are not real backend verification |
| System/E2E | Final PWA fixture PASS; full UI regression FAIL; fresh real API E2E BLOCKED | Compatible isolated test DB unavailable; no real-account substitution |
| Security | Authorization/storage cases tested; audit FAIL | 25 moderate, zero high/critical production advisories in `test-results/audit-cycle.json`; audit exited 1 |
| Performance | PASS bounded client smoke | 10,000 input messages retained 1,000 in 47.1 ms; 100 concurrent queued writes/sends in 21.87 ms using memory storage. Final PWA fixture: online 2.579 s, offline 0.646 s; observed on this PC, synthetic signed-out API. |
| Backend load | NOT RUN | No authorized staging load target; no production load/security probing |
| Regression | First full run FAIL; corrected UI retest FAIL on stale color assertion | `npm.cmd run verify` passed static/unit/tool stages then detected duplicate group fields. Failure preserved as `test-results/verification-cycle-ui-failed.json`; retest `test-results/web-cycle-retest.log`. |

## Fresh backend boundary

`GET http://127.0.0.1:5000/api/jm/auth/csrf/` returned **204, zero response bytes**, as expected for CSRF initialization. Evidence: `test-results/backend-readonly.json`. This does not establish successful sign-in by itself.

`python -B scripts/check-live-schema.py` inspected only the existing isolated `test_` database with a read-only connection. It found missing `files_upload.discarded_at` and table `messenger_eventreminder`. Evidence: `test-results/live-schema-preflight.json`. No migrations ran. Fresh two-independent-client messaging, sign-in/logout and native/backend E2E are therefore **BLOCKED** this cycle. Earlier real browser/native smoke tests remain historical evidence only.

## Implemented cases to exercise

- A queued bubble appears only after persistence; failed storage retains the draft. Restored queue entries keep account ownership and client IDs, retry temporary failures with persisted exponential delay, and preserve queued order.
- Native recent-history cache binds only after server session validation, expires at 30 minutes/session expiry, excludes locked/expired content, and clears on logout or confirmed access loss. Browser recent history is memory-only. Offline cold-start authentication remains locked.
- A network failure racing a permission refusal must never expose cached history. Fresh locked detail must prevent fallback to an older unlocked cache. Lock events invalidate in-flight responses immediately.
- Current event cards, RSVP and response lists use existing endpoints; shared media uses sequence cursors; disappearing settings use existing values; deactivated peers cannot compose.
- Phone actions re-fetch privacy-filtered profile numbers before handing off to the dialer. Password/passphrase generation uses secure randomness; generation itself does not save a secret to the server.
- Responsive browser regression covers 360×1000, 768×1000, 1440×1000 and 844×390, including phone options menus, navigation restoration, vault/admin actions and cross-tab queue/session behavior.
- Service worker caches only its public build shell, leaves private API/files/socket traffic network-only, reloads the shell offline and waits for explicit update activation. Failed precache installs remove their incomplete cache.

## Visual comparison

Original frontend and Universal screenshots use equivalent synthetic data. Four Universal light/dark × narrow/wide captures passed without uncaught errors or horizontal page overflow on the first production export. One original dark-desktop chat capture timed out; no automated pixel-diff pass is claimed. See [UI evidence](docs/UI-PARITY-2026-11-02.md). Later immersive navigation, avatar seeds and compact composer integration require final screenshots. Full visual parity remains PARTIAL.

## Findings, fixes and limits

The initial performance harness imported app modules into the Node-only tooling configuration; that exposed alias/type-context failures. It was moved into a Vitest test with explicit Node test types. No application compiler rules were weakened. The corrected harness passed all final TypeScript checks and its benchmark test. Browser regression then found duplicate sibling keys on GroupEditor and SharedMedia, which caused repeated Group title fields after refresh. SharedMedia now has a distinct prefixed key; regression selectors were not loosened. The retest passed that group flow, profile, generator and vault entry steps, then expected the old dark text rgb(237,246,239) while the reference token is rgb(241,245,249). The exact expectation was updated; the complete four-layout/cross-tab run was NOT rerun before the hard stop. This remains an incomplete/failed E2E acceptance gate. A subsequent import-order lint warning was fixed without changing behavior; final lint passed with zero warnings.

Security findings that remain: browser IndexedDB outbox contents are not application-encrypted; the backend documents an expected-account header but its Python implementation was not found; permission revocation cannot be checked while offline; 25 moderate dependency advisories remain. Service-worker privacy isolation does not fix these separate limitations.

Native hardware and OS handoffs, background push, verified links, passkeys, iOS, signed releases, exact visual/gesture parity, location/event creation/edit/calendar/map flows, persistent encrypted browser history and the full chat unlock flow are not certified. Synthetic timing/queue stress is not backend load, native scroll/FPS or large-device-memory validation.

## Changed files and artifacts

The complete working-tree file list is `test-results/changed-files.txt`. Main changes: shared UI/branding and mobile chat layout; typed API contracts; history/outbox/cache controllers and adapters; shared media/event cards/phone/generator components; production web/PWA scripts, assets and worker; regression tests; design/decision/testing and parity documents. Production web output is `dist/`. **There is no current APK**, because regeneration removed the previous artifact and the current build was stopped. Native build status is `test-results/android-build.json`. No deployment or store submission occurred.

## Reproduction

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run verify
npm.cmd run build:web
npm.cmd run test:pwa
python scripts/inventory-migration.py
```

`verify` runs strict app/tools/worker checks, warning-free source lint, Vitest, Node proxy/PWA policy tests, then four browser layouts and cross-tab tests. The performance test writes `test-results/performance-smoke.json` for a synthetic 10,000-message bounded window and 100 concurrent queued writes. All browser test API fixtures are explicit mocks; they are not production behavior replacements.

Do not run `scripts/prepare-live-fixture.py` in this read-only cycle: it includes migrations. Obtain an authorized compatible isolated database before fresh authenticated E2E. Build Android before starting the emulator on this 8 GB PC; commands and signing blockers are in the deployment guide. No public deployment or store submission occurred.

## Final handoff

Initial cycle ended at the hard 09:12 UTC limit. Static analysis, 337 unit tests, seven tooling tests, synthetic client performance and final production PWA smoke passed. Full browser regression did not pass; Android build is incomplete with no APK; iOS and fresh real-backend E2E are blocked. Resume with the corrected complete browser regression, finish the incremental Android build, then validate against an authorized compatible isolated backend. No background work is intended to continue after this cycle.
