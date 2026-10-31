const fs=require('fs');const verification=JSON.parse(fs.readFileSync('test-results/verification-latest.json','utf8'));if(verification.status!=='passed')throw Error('Latest aggregate must pass before publishing checkpoint');const stamp=verification.finished;
const intro=`## Latest source checkpoint - ${stamp}

Universal only. Latest aggregate passed TypeScript, uncached ESLint with no warnings, **30 unit files / 196 tests**, four mocked Edge viewports (**360x1000, 768x1000, 1440x1000, 844x390**) and the isolated two-tab browser regression. Commands: node verify-current.cjs; node reassess-dependencies.cjs; node capture-verified-source.cjs; node verify-final-hashes.cjs. Evidence: test-results/verification-latest.json and stage logs; the manifest records the final source, documentation and dependency evidence. No builds, exports, live backend calls, credentials, or actual device permissions were used.

- Closed reviewed cross-tab outbox defects: shared auth-change notifications freeze/abort queues, Web Locks coordinate this client's login/logout and delivery, every send revalidates authenticated identity, transactional per-entry storage and tombstones prevent snapshot overwrite/resurrection, and logout invalidates stale storage leases. Synthetic browser tests cover concurrent enqueue/discard/delivery/logout, legacy-key migration, page reload persistence, shared-cookie A-to-B mismatch blocking and auth/send ordering. This does not establish an atomic backend account precondition against unrelated clients changing cookies outside this coordination protocol.
- Closed picker lifecycle defects: native selected documents are copied into an owned cache directory, with cleanup handles; stale/replaced/cancelled/completed/unmounted selections are disposed. Profile/group photo selection uses generations. Native provider and cleanup behavior remains device-unverified.
- Added profile/group image crop percentages, rotation, flips, PNG conversion, web frame effects, group avatar upload/removal and restored the 16 MB photo limit (8 MB backgrounds). Edited outputs are revalidated. Native frames and the original drag/zoom/live transform preview are still missing.
- Added explicit voice recording/review (60-second maximum), camera photo capture, selected phone-contact/vCard import and review before attachment upload. Permission requests occur only from action buttons; background/cancel invalidates pending work. Browser tests use synthetic media/contact objects and generated files; native cleanup tests use mocked filesystems. No real recording, camera, contact or sensitive export occurred.
- Added conditional browser install-prompt UX with dismissal/retry/installed states. Tests dispatch synthetic events; installability, service-worker/offline packaging and actual installation are unverified.
- Added exact SDK-compatible expo-image-manipulator 58.0.15 and expo-contacts 58.0.8. Final full and omit-dev audits remain **19 high, zero moderate/critical**; Expo compatibility passes. No forced upgrade or advisory suppression.

Native durable outbox remains deliberately memory-only. Native passkeys remain unavailable. See REMAINING-PARITY.md for exact source and integration gaps. Source/mock verification is not Android/iOS validation or blanket feature parity.

`;
let status=fs.readFileSync('JIVO-063-STATUS.md','utf8');status=status.replace('## Latest source parity checkpoint - 2026-10-20T10:31:24.094Z','## Historical source parity checkpoint - 2026-10-20T10:31:24.094Z');status=status.replace('# JIVO-063 - source migration status\n','# JIVO-063 - source migration status\n\n'+intro);fs.writeFileSync('JIVO-063-STATUS.md',status);
fs.writeFileSync('REMAINING-PARITY.md',`# JIVO-063 remaining parity reconciliation

Latest source checkpoint: ${stamp}. Reference: read-only original frontend. Implemented means code exists; synthetic tests do not establish live/native integration.

| Area | Implemented | Tested / remaining distinction |
|---|---|---|
| Home and messaging | Capability tiles; mentions, safe links/server previews, typing/presence, receipts/reactions, selected senders | Four viewport mocks; caret-position mention editing, composer link preview and per-conversation draft retention differ from original |
| Browser outbox | Persistent per-entry transactions, tombstones, owner isolation, retry/discard, auth boundary propagation and pre-send identity check | Two actual browser tabs with synthetic shared cookie/API: concurrent changes, legacy-key upgrade, logout leases, reload, mismatch blocking and auth/send lock. React Session integration across two full app tabs and unrelated-client cookie mutation remain unverified |
| Native outbox | In-process retry, abort, owner isolation | Memory-only: pending messages are lost on process exit. Protected durable storage is missing; no plaintext native database or invented encryption |
| Profile/background | Photo upload/remove; organization color/image/default/remove; 16 MB photos / 8 MB backgrounds | Mocked photo/color flows; background image/default/remove permutations need focused interaction tests |
| Image editor and group avatar | Crop percentages, rotate/flip, PNG output, web frames; group avatar upload/remove | Four viewport edit/invalid crop/reset/cancel/save/remove tests; native ownership cleanup mocked. Native frames, drag/zoom and live transformed preview missing; GIF animation is flattened by editing |
| Capture/import | Explicit voice start/stop/review, camera photo, selected contact/vCard import, review and attachment upload | Synthetic browser denial/retry, repeated/interrupted recording, camera chooser, contact import/discard/add; unit late-result/cleanup tests. No real device API used; native picker focus/permission behavior unverified |
| Install UX | Conditional beforeinstallprompt, dismissal/retry, installed state | Synthetic events only. No manifest/service-worker/installability guarantee or actual install |
| Vault/admin/notifications | Prior file/export, step-up/cancellation, permission confirmation, vault administration and mapped navigation source retained; direct admin password UI | Existing mocks pass; native file/cookie/CSRF/WS integration remains unverified |

## Genuine missing source features

- Native protected durable outbox; native passkey platform bridge and verified app/domain association; native push registration and OS app/universal-link configuration.
- Native image frame effects and original interactive drag/zoom/live transformed preview; broader original photo-format handling is not claimed.
- Messenger attachment export/download and managed export cleanup, distinct from the implemented vault export adapter.
- Per-conversation draft retention, full caret-aware mention UX and composer-side preview behavior; exhaustive original interaction/pixel parity is not claimed.
- Production web install/offline packaging and service-worker behavior are not implemented or validated by the conditional install control.

## Source implemented but integration/branch coverage incomplete

Owner/emergency approve/deny/revoke combinations; vault member role/removal and shared-entry permission combinations; group membership authority variants; recovery variants; revoke-all devices; non-conversation notification destinations; presence privacy/error paths; background image/remove/default branches. Existing API wrappers do not prove these interactions.

Native cookie/CSRF/WebSocket interoperability, authenticated media, system permissions, font scaling, keyboard/safe-area behavior, native decoding/capture and actual file sharing remain unverified. Picker results are conservatively discarded on lifecycle invalidation; actual Android/iOS picker AppState transitions need device validation. Vault native export remains limited to 20 MiB, with documented cache/process/receiver-copy constraints.

Browser outbox coordination requires Web Locks and IndexedDB; unsupported locking fails closed. It coordinates this client only, not arbitrary external clients or direct cookie changes between identity validation and send. Backend authorization remains authoritative. Browser drafts are local plaintext payloads; no auth tokens or vault secrets are stored there.

The original frontend hides Companies and has no admin audit-log screen; Universal's limited Companies tab remains a known navigation difference. No original frontend/backend/services/deployment/secret changes were made.
`);
let native=fs.readFileSync('NATIVE-INTEGRATION-ASSESSMENT.md','utf8');native=native.split('## Messaging/profile source pass')[0];native+=`## Capture, image and outbox source assessment (${stamp})

Native capture adapters use the existing Expo audio/image-picker modules plus exact SDK-compatible expo-contacts 58.0.8; image transforms use expo-image-manipulator 58.0.15. app.json declares action-specific microphone/camera/contact permission text, disables background recording/playback, and blocks Android WRITE_CONTACTS. Native generated projects are stale and were not rebuilt. These are declarations and source, not observed OS behavior.

Camera/contact/voice actions begin only after an explicit button. Captures are reviewed before uploading to the existing scanner endpoint; adding an attachment does not send the message. Contact selection reads one selected contact, never bulk syncs or writes contacts. Voice auto-stops after 60 seconds. Cancellation/background invalidates results and attempts owned-cache cleanup. Temporary outputs are cache files and can remain after process death or cleanup failure; deletion is not secure erasure. OS/provider caching and native AppState transitions around system pickers need device checks. No actual microphone/camera/contact permission or data access was performed.

Document selection copies only the chosen local provider file into a uniquely owned cache directory. Replacement, cancellation, successful upload and unmount dispose ownership handles. Late selections are disposed after generation invalidation. Image manipulation returns owned cache output and releases native handles; metadata failure cleanup has synthetic tests. Native crop/rotate/flip and PNG conversion are implemented; frame effects remain web-only. Editing animated GIFs flattens them. Native authenticated upload and format decoding are unverified.

Native outbox is intentionally memory-only. Durable native drafts require a reviewed account-bound encrypted storage/key lifecycle, logout destruction, backup behavior and process/device tests. SecureStore alone is not a complete durable message queue. No new plaintext native message store, credentials persistence, custom cryptography or pretend secure fallback was added. Pending native messages are lost on process exit.

Browser outbox uses transactional IndexedDB entries/tombstones and Web Locks, revalidates authenticated identity before send, and freezes other tabs on this client's auth changes. Synthetic two-tab shared-cookie tests pass; real backend integration and atomic protection against unrelated clients changing cookies outside the lock are not established. Native passkey and vault export caveats above remain unchanged.
`;fs.writeFileSync('NATIVE-INTEGRATION-ASSESSMENT.md',native);
let readme=fs.readFileSync('README.md','utf8').split('## Current source parity additions')[0];readme+=`## Current source checkpoint

See REMAINING-PARITY.md and JIVO-063-STATUS.md for ${stamp}. Home/messaging/admin source, coordinated browser outbox, owned-picker cleanup, profile/group image editing, capture/import adapters and conditional web install UX have selective synthetic coverage. Photos allow 16 MB; backgrounds 8 MB. Native outbox remains memory-only; native passkeys remain unavailable.

Manual builds above are user-run only. Current native modules/configuration include file-system/sharing, audio, image-picker, contacts and image-manipulator. Review generated permission/configuration changes; existing android/ and dist/ are stale. Test denial/retry/cancel/background flows and provider cleanup on real devices in a separately authorized integration phase. No real permission, credential change or backend request was used here.
`;fs.writeFileSync('README.md',readme);
fs.appendFileSync('DEPENDENCY-TRIAGE.md',`\n## Final capture/editor dependency recheck - ${stamp}\n\nAdded exact Expo SDK 58 bundled versions expo-image-manipulator 58.0.15 and expo-contacts 58.0.8 with install scripts disabled. npm audit --json and npm audit --omit=dev --json both report 19 high, 0 moderate/critical; Expo install --check reports dependencies up to date. Latest registry braces 3.0.3 and node-forge 1.4.0 remain within the advisory ranges listed above. No compatible safe fix was identified. Audit exit 1 indicates unresolved advisories, not successful remediation. Native runtime reachability remains unproven; omit-dev includes toolchain dependencies. No forced downgrade, suppression, account or paid service was introduced.\n`);
console.log('Updated final source-only parity documents:',stamp);
