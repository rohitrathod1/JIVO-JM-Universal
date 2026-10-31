# JIVO JM Universal

Incremental React Native / Expo / React Native Web migration for JIVO-063. Current progress, evidence, native limitations and remaining parity work are in [JIVO-063-STATUS.md](./JIVO-063-STATUS.md).

## Source checks

```powershell
npm run typecheck
npx eslint src --no-cache
npm test
npm run test:web
```

The web test uses an ephemeral localhost development server and mocked API responses. It requires installed Microsoft Edge and never needs real credentials. It closes its own test server when finished. Test screenshots go to `test-results/`.

## Local development

```powershell
npm run web
```

`/preview` shows fictional layout content without API calls. To connect later, configure only `EXPO_PUBLIC_API_ORIGIN` for an explicitly approved non-production HTTPS server. The value is public. Never put credentials, backend secrets, OpenBao values or session tokens in Expo public configuration. No real server is configured in the distributed source.

The current instruction is to leave all builds to the user. No automated build/export is part of source verification. Native cookie support requires a custom development/native build; Expo Go does not establish native cookie-module compatibility. The generated Android project and old `dist/` are from earlier checkpoints and are not validated against the current source. Configure final application IDs and signing independently before any release. iOS compilation requires macOS/Xcode.

No backend change, service restart, push or deployment is included.

## Manual builds — user-run only

These commands are instructions for the user; the migration agent has not run them against this source checkpoint. They generate local artifacts and do not deploy anything.

1. Work in this Universal project. Review `JIVO-063-STATUS.md` and `DEPENDENCY-TRIAGE.md` first: feature parity and native integration are incomplete, and 20 high audit entries remain unresolved.
2. Run `npm ci`, then `node verify-current.cjs` and `npx expo install --check`. The aggregate checks require Microsoft Edge for mocked browser tests. A passing check does not validate Android/iOS authentication or media.
3. Choose your final `android.package` and `ios.bundleIdentifier` in `app.json`. The Android ID is still a template value. Configure only an approved public API origin; never put passwords, session cookies, OpenBao or backend secrets in public environment variables.
4. For local Android development, install compatible Android Studio/SDK/JDK tooling and select an emulator or connected device. Review generated native changes, then run:

   ```powershell
   npx expo prebuild --platform android
   npm run android
   ```

   An earlier Android attempt failed in CMake/Ninja with Windows path lengths. That earlier generated `android/` directory is stale relative to the current plugins. If the same problem occurs, use a shorter working path for this same project and inspect the build log; no system settings or paths were changed automatically. Do not discard native edits when regenerating.

5. On a Mac with Xcode and simulator tooling, review generated native changes and run:

   ```sh
   npx expo prebuild --platform ios
   npm run ios
   ```

   Windows cannot validate iOS compilation. Native passkeys remain unimplemented. Cookie/session sharing with WebSocket and authenticated media must be tested on actual native builds; Expo Go does not validate the custom cookie module.

6. For a local web artifact, run `npm run build:web`. Inspect its routes and public API configuration locally before any separately authorized hosting change. Old `dist/` output is not evidence for the current source.

These are local development/build instructions, not release-signing or store-submission instructions. No EAS account, paid service, push, store submission or deployment is required by this source handoff.

## File and passkey integration limits

See [NATIVE-INTEGRATION-ASSESSMENT.md](./NATIVE-INTEGRATION-ASSESSMENT.md). Vault files have shared UI and mocked web coverage. Native upload uses local document-provider URIs and still needs device validation. Native export source now uses SDK-matched file-system/sharing modules, with a 20 MiB conversion limit and controlled temporary cache cleanup; OS handoff and cleanup remain device-unverified. Native passkeys require a platform bridge and verified app/domain/server compatibility. No build or server changes were made to establish those prerequisites. The current native project must include the added file-system/sharing modules when you perform the manual build; no inbound-sharing extension or domain entitlement was configured.

## Current source checkpoint

2026-10-21T05:40:43.143Z: see FEATURE-PARITY-CHECKLIST.md, REMAINING-PARITY.md and JIVO-063-STATUS.md. Messenger export and drag/zoom/native-frame source are now included. Native device behavior remains unverified.

The current native dependency set additionally includes react-native-view-shot 6.1.1. Manual prebuild/autolinking must include it alongside cookie manager, file-system/sharing, audio, image-picker, contacts and image-manipulator. Existing android/ and dist/ are stale. Do not discard native edits when reviewing regeneration. No platform build or export was run by the agent.

Validate synthetic denial/retry/cancel/background scenarios on devices first, then separately authorize integration with a non-production server. No real credentials are needed for the mocked checks. Native outbox is memory-only; native passkeys and push/link configuration remain unavailable. The cross-client principal-binding prerequisite requires owner review; this frontend task made no backend changes.

### Latest bounded follow-up

2026-10-21T05:49:58.588Z: source/mock verification now includes 265 tests across 40 files plus four responsive browser viewports and cross-tab tests. App-lock storage/cancellation defects are fixed. Explicit web copy is available; automatic OS clipboard clearing and native copy are unavailable. Read CLIPBOARD-LIFECYCLE.md before manual clipboard testing. Never use real secrets for the verification suite.
