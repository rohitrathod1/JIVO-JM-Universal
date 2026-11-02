# Remaining parity and integration — 2026-10-21T05:40:43.143Z

See FEATURE-PARITY-CHECKLIST.md for the full original-to-Universal mapping and REFERENCE-SOURCE-INVENTORY.json for reference paths/hashes. Latest source verification is recorded in JIVO-063-STATUS.md. Neither source nor mocks establish native/live behavior.

## Completed bounded source work

Explicit web secret copy, 30-second reveal limit and reviewed app-lock fail-closed storage/whole-attempt cancellation are implemented with synthetic coverage. Clipboard automatic clearing and native copy remain unavailable as detailed below.

Messenger attachment export, shared drag/corner crop editing, aspect presets, zoom, transformed preview and native frame adapter are implemented. Camera/contact late-permission actions and independent recording cleanup are fixed with dependency mocks. Existing outbox, picker, vault/admin and responsive regressions remain in the aggregate suite.

## Genuine remaining source gaps

- Automatic OS clipboard clearing remains unavailable: browser APIs cannot atomically verify ownership before clearing, so no timer/background empty write is used. Explicit web copy is implemented; native copy requires a validated adapter. See CLIPBOARD-LIFECYCLE.md.
- Native device app lock and automatic web passkey sign-in hints; the web device privacy screen is implemented but device/server integration remains unverified.

- Protected durable native drafts: native outbox remains memory-only; app termination loses pending messages. No plaintext native database or invented crypto.
- Native passkey bridge/domain association; browser/native push registration/background delivery; OS app/universal-link configuration.
- Original global alert banner/popup/bell presentation, notification sound/vibration execution, rich received contact/person views, poll voter details, original image gallery/pinch-pan and audio seek/speed controls.
- Per-conversation draft retention, full caret-aware mention editing/composer-side previews, swipe/pull shortcuts and exact skeleton/blurhash presentation.
- Actual web install/offline service-worker packaging is not provided by the conditional install control.

## Intentional differences

Exports require explicit review and accept only configured-origin /api/jm/ attachment URLs; other paths fail closed pending contract verification. Native export limits are 20 MiB. Photo editing outputs PNG and flattens animation; native frames rasterize a bounded image view and can resample. Native circle frames require square crops. Aspect presets initialize a crop but do not lock subsequent corner resizing; original edge handles and zoom slider differ. These are not pixel-identical editor claims.

## Required integration and remaining branch verification

Native cookies/CSRF/WebSockets/media, permission denial/retry/background behavior, keyboard/safe areas/font scaling, frame rendering and actual export receivers need manual Android/iOS validation. Conservative lifecycle invalidation can discard results when system pickers background the app. Device tests must assess that behavior.

Owner/emergency decisions/revocation, vault/member/shared-entry permission combinations, group authority/history sharing, account recovery/revoke-all, non-conversation notification targets and background image/default/remove branches remain incompletely interaction-tested.

Cooperating same-origin tabs use locks and per-send identity validation. Another origin/client may mutate the shared session between /me and POST. Server-side expected-principal binding on the mutation is required to close that race across all clients; no backend change was made.

Outstanding audit: 20 high inherited package entries; SDK-compatible dependencies are not an absence-of-vulnerabilities guarantee. Full production readiness and complete original parity are not claimed.
