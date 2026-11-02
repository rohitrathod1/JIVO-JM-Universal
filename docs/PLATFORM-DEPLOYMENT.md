# Universal platform builds and deployment

All commands run inside `JIVO-JM-Universal`. The frontend and backend reference projects are read-only. No production service, schema, signing account, store listing or deployment was changed. See [testing.md](../testing.md) for the integrated validation report.

## Production web and PWA

```powershell
npm.cmd run build:web
$env:JM_BACKEND_URL='http://127.0.0.1:8000'
$env:JM_WS_ORIGIN='http://127.0.0.1:8000'
npm.cmd run preview:web
```

Open `http://127.0.0.1:4175`. `JM_PREVIEW_PORT` changes that port. The preview binds only to loopback and proxies API/WebSocket traffic to the existing local backend. The WebSocket origin override is for local development only and must name an origin the backend already trusts. No backend configuration change is needed for the documented local setup.

`build:web` exports the Expo single-page application, adds the manifest and original frontend icons, then generates a versioned service worker from the exact exported static files. The distributable is `dist/`; build statistics are in `test-results/web-build.json`. Never serve the project root or `.env` files. The browser uses its current origin for API requests and WebSockets; Android/iOS continue using `EXPO_PUBLIC_API_ORIGIN`.

`npm.cmd run web` remains the Metro development launcher at port 5175. PWA registration is production-only so development bundles are never installed as an offline app. Use `preview:web` for PWA testing.

The PWA currently provides:

- The reference application's name, colors, standalone display, original 192/512/maskable/apple icons, and Chats/Notifications shortcuts.
- A public offline shell covering the application's existing routes. A first successful online visit and completed service-worker installation are required.
- Browser install prompt where supported; Safari Add to Home Screen guidance elsewhere. The prompt appears after sign-in and a dismissal lasts seven days.
- Updates waiting for the person's explicit Reload action. Save unfinished edits before reloading. One preceding shell cache is retained for already-open tabs.
- An exact build-time static-asset allowlist. API responses, credentials, message history, vault contents, authenticated media, maps, sockets and arbitrary URLs are never written to Cache Storage. Authenticated offline data belongs to the separate account-bound storage layer; loading the public shell does not establish an authenticated session.

Incoming share-target intake and explicit review are implemented; see [INCOMING-SHARING.md](INCOMING-SHARING.md) for limits, account isolation and platform validation. Browser push subscription/test/cleanup and worker notification handling are implemented. The final expanded browser/PWA regression passes. Live VAPID/provider delivery remains unverified; source and fixture tests are not provider validation. Closed-app automatic queue delivery is not promised: reopen the app to resume supported synchronization. Browser/OS storage can be evicted; installation is not a backup. Actual OS installation and Safari/iPhone behavior need device validation.

### Hosting contract

Use an approved HTTPS origin. Serve `dist/` at the origin root, route `/api/` and `/ws/` to the existing ASGI backend, and support SPA history fallback for the known application routes. The backend must already accept that public HTTPS host/origin and issue correctly scoped secure cookies. Those production prerequisites are not configured here.

`sw.js`, `index.html` and `manifest.webmanifest` must revalidate (`Cache-Control: no-cache`). Hashed Expo assets may use long immutable caching. Never apply an API cache or HTML fallback to API/files/socket routes. Publish an entire build atomically; retain preceding hashed assets long enough for open tabs. The reference nginx template in `deploy/nginx-universal.conf.example` is unexecuted and requires domain, certificate, ASGI port and filesystem values from the operator. It must be reviewed against the existing deployment before use.

### PWA validation

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:tools
npm.cmd run build:web
npm.cmd run test:pwa
```

The last command launches isolated loopback HTTP fixtures on 5188/5189 and headless Edge. It verifies the real production bundle, manifest/icons, cache isolation, offline cold reload, waiting update and explicit activation. It does not authenticate against the real backend. Reports/screenshots: `test-results/pwa-smoke.json`, `pwa-online.png`, `pwa-offline.png`. Policy tests also cover non-GET requests, ranges, cross-origin requests, unknown navigation and query-string assets. The preview processes and test browser stop on completion.

## Android

The final continuation x86_64 debug build **passed** on 2 November 2026 in 12m 9s (368 tasks). Artifact: `android/app/build/outputs/apk/debug/app-debug.apk`, 80,881,314 bytes. SHA-256: `1570c5823e45797fa436bda2cd2ad37d0dc1f2b1d44d1754d5b3be6c64681dac`. Evidence: `test-results/android-build.json` and `test-results/android-build-final.log`. This supersedes the initial-cycle `INCOMPLETE` record.

The earlier continuation APK was installed and restored the existing emulator session/list, connected to `/ws/`, and opened/discarded synthetic ACTION_SEND text without sending a message. The final APK adds the multiple-text MIME filter and was subsequently installed for the final native two-account check. Native UI send and a reply from the second account API client passed; both labeled messages were removed. See test-results/native-account-final.json. See `test-results/native-continuation.json` for that exact runtime scope and emulator memory/linking warnings. The earlier check established no message writes; the later final-APK test establishes scoped two-account native send/receive. Physical GPS/camera/biometric/share-provider behavior remains unverified.

```powershell
# Rebuild only when source/native configuration requires it:
# npm.cmd run android:build
# Start the Android Studio emulator, then wait for readiness and forward the API:
npm.cmd run android:ready
npm.cmd run android:launch
```

`android:ready` reconnects offline ADB devices, waits up to five minutes for `device` and `sys.boot_completed=1`, then reverses app port 8000 to the named backend port. If the backend uses 8000, omit `-BackendPort 5000`. If readiness times out, use Android Studio Device Manager Cold Boot; rerunning prebuild does not repair an offline emulator. Build before starting the emulator on this 8 GB computer.

The build script limits Gradle/CMake workers and uses a temporary short Windows drive alias. Native directories are generated by Expo when app configuration/dependencies change. The script removes its alias afterwards. Output: `android/app/build/outputs/apk/debug/app-debug.apk` (x86_64 emulator); `-Architecture arm64-v8a` selects a physical ARM64 device build. The debug app requires Metro. The generic template icon references were replaced with the frontend's JM artwork in app configuration.

Release AAB/APK signing is pending: the current development application ID is preserved, signing credentials and store ownership are not supplied, and no production backend domain is selected. Do not distribute the debug APK as a signed production build. Native passkeys, verified HTTPS app links, background push and release splash validation remain separate release gates.

## iOS

The shared TypeScript code and Expo configuration are present, including the original opaque JM maskable icon as the iOS icon. A macOS machine with Xcode, an approved bundle identifier and Apple signing access are required for simulator/device/archive validation. This Windows cycle cannot establish an iOS build result. The source artwork is 512 px; obtain the original 1024 px opaque brand asset for App Store release quality. No signing account or invented bundle identifier is added.

On an authorized Mac after identifiers are finalized: `npm ci`, configure the approved native backend origin, then `npm run ios`. For a cloud build, first configure EAS against an authorized account and confirmed signing identities. No cloud build or store submission was started.

## Implementation references

- [Expo SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/)
- [Expo progressive web apps](https://docs.expo.dev/guides/progressive-web-apps/)
- [Expo web publishing](https://docs.expo.dev/guides/publishing-websites/)
- [Expo SDK 58 app configuration](https://docs.expo.dev/versions/v58.0.0/config/app/)
- [Expo splash screens and app icons](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)

PWA behavior was mapped from the read-only frontend's `vite.config.ts`, `src/sw.ts`, `src/core/pwa/InstallPopup.tsx`, `src/core/pwa/UpdatePrompt.tsx`, `design.md` and `decision.md`.
