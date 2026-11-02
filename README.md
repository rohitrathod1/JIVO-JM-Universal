# JIVO JM Universal

Expo SDK 58, React Native and Expo Router application for Android, iOS and web. All application code under `src/` is strict TypeScript. A fresh rewrite is unnecessary: existing messenger, passwords, profile and administration screens are retained and improved against `JIVO-JM-Frontend`.

Current evidence and remaining device checks: [STATUS.md](docs/STATUS.md). Older source-only checkpoints are under [docs/archive](docs/archive). They do not describe the current build.

## Install and check

```powershell
cd C:\Users\JIVO\Desktop\JM\JIVO-JM-Universal
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:web
npx.cmd expo install --check
```

`test:web` runs mocked Edge browser interactions, including responsive layouts, session boundaries, permissions and vault flows. `npm.cmd run verify` combines source and browser checks. Test reports and screenshots are written to ignored `test-results/`. Configuration and older browser-test tools use JavaScript; application screens, shared logic and the local web launcher use TypeScript.

## Web development

Keep the existing backend running separately, then:

```powershell
npm.cmd run web
```

Open **http://127.0.0.1:5175**. The original frontend can continue using 5174. The Universal launcher proxies API requests and WebSockets to `http://127.0.0.1:8000` and Metro to internal port 8081. Use 5175 in the browser.

If your existing backend uses port 5000:

```powershell
$env:JM_BACKEND_URL='http://127.0.0.1:5000'
$env:JM_WS_ORIGIN='http://127.0.0.1:8000'
npm.cmd run web
```

The HTTP proxy preserves the browser's host and origin. For WebSockets, it first validates the browser origin, then uses `JM_WS_ORIGIN` (default: the backend origin) for the existing backend's origin check. The value must be a loopback HTTP origin that the backend already trusts; this local setup already trusts `http://127.0.0.1:8000`. Foreign or missing browser origins are rejected. Cookie authentication and CSRF remain enforced. `GET /api/jm/auth/csrf/` returning **204 No Content** is successful cookie initialization; the response intentionally has no body. Backend configuration and source remain outside this Universal-only change.

`JM_WEB_PORT` and `JM_METRO_PORT` override the launcher ports. The launcher sets its child process's public API origin and preserves the Android `.env`. `/preview` shows fictional layout content without signing in.

## Android Studio emulator

On this 8 GB Windows PC, build before starting the emulator:

```powershell
cd C:\Users\JIVO\Desktop\JM\JIVO-JM-Universal
npm.cmd run android:build
# Start the emulator in Android Studio Device Manager and wait for its home screen.
adb devices
adb shell getprop sys.boot_completed
adb reverse tcp:8000 tcp:8000
npm.cmd run android:launch
```

The local `.env` uses `EXPO_PUBLIC_API_ORIGIN=http://127.0.0.1:8000`. If the backend runs on 5000, use `adb reverse tcp:8000 tcp:5000` instead. Repeat reverse after restarting or reconnecting the emulator. For multiple devices, specify `adb -s <serial>`.

Wait for `sys.boot_completed` to print `1`; ADB can show `device` before Android is ready to install apps. If this emulator asks for nearby/local connection permission during development, allow it to reach Metro and the local API. The first JavaScript bundle can take a minute on this PC. Metro excludes generated native caches so later starts do not scan CMake build output.

`android:build` regenerates native configuration when app configuration or dependencies change and builds only x86_64, with one worker and Kotlin in-process. It uses an ignored `.native-build/` cache and CMake object-path hashing to stay within Windows path limits. `android:launch` installs the existing APK and starts Metro. Use this pair on Windows; the standard `npm.cmd run android` command does not apply the Windows build adjustments. For an ARM64 device, run `npm.cmd run android:build -- -Architecture arm64-v8a` first. The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`.

The build temporarily maps an available drive letter to this project for the app's CMake cache, then removes that mapping on exit. Files stay in the project. This follows the short-path approach in [Reanimated's Windows build guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/building-on-windows/); no registry edit or dependency downgrade is needed.

If ADB reports `offline`, close the emulator and use Device Manager > Cold Boot Now. Restart ADB if necessary with `adb kill-server` and `adb start-server`, then confirm `device` before running again. Prebuild cannot fix an offline emulator. Do not wipe the emulator's data for this error.

This app uses a native cookie module and needs its own native build. Expo Go is insufficient. Android Studio can open the generated `android/` folder; make lasting native configuration changes in `app.json`, not generated files. iOS compilation and device checks require macOS/Xcode.

## Current behavior

- Cookie sessions and CSRF use the existing API; WebSockets reconnect, track connection state and reconcile missed messages.
- The outbox retries on reconnect/foreground. Android/iOS queued messages use chunked OS-protected storage and are cleared at sign-out. Browser queues use IndexedDB. Composer drafts remain in session memory per conversation.
- Native device lock, native secret copy, unread counts, live alert banner/popups and preference-aware sound/vibration are implemented.
- Contact profiles, poll voters, audio seek/speed, image zoom/pan and navigation across loaded photos, cursor-aware mentions and draft link previews are available.
- No `/approvals` feature was added; that request was withdrawn. No frontend/backend source change is required by this app checkpoint.

Android emulator verification passed for real sign-in, sending and receiving live messages, restoring the cookie session and an OS-protected queued message after terminating the app, delivery exactly once after reconnect, and sign-out. Evidence is in `test-results/native-smoke.json` and `native-*.png`. The debug APK needs Metro; it is not a signed release build.

Native passkeys, verified HTTPS app links and background push remain deferred under the agreed local-development scope. Full device/OS parity and release readiness require the checks listed in the status document.

## Cleanup

135 obsolete patch scripts, audit snapshots, logs and template entry points were removed. [Cleanup manifest](docs/cleanup-2026-11-02.json). The recovery archive is outside this repository at `../.maintenance-backups/universal-cleanup-2026-11-02.zip`. Active runtime code, assets and reusable verification tools are retained.
