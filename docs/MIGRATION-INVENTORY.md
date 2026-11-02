# Migration inventory - 2 November 2026

This continuation inventory maps the read-only frontend to the landed Universal implementation. Current static/unit/tooling and Android build checks pass; responsive browser and production PWA validation passed; this document distinguishes implemented flows from executed tests. It accompanies [the feature checklist](../FEATURE-PARITY-CHECKLIST.md), [design.md](../design.md), [decision.md](../decision.md), and [testing.md](../testing.md). It does not certify behavioral or visual equivalence.

## Reproducible source inventory

Run `python scripts/inventory-migration.py` from Universal. It reads only the sibling frontend `src/`, `public/` and package manifest, plus the equivalent Universal paths, and writes [migration-inventory-2026-11-02.json](migration-inventory-2026-11-02.json) here. No application configuration, account data, database, credentials or `.env` is loaded. The linked JSON was refreshed at 2026-11-02T11:11:37.374088+00:00; it contains 258 frontend and 299 Universal source/public files. These counts describe source inventory, not passed runtime features.

Each file records its relative path, size and SHA-256. TypeScript files also record lexical named exports; API modules record literal HTTP path expressions; route declarations are collected with commented-out lines removed. Both runtime and development dependency versions are included. These are a review index, not a TypeScript compiler call graph: re-export aliases, computed paths and behavioral transformations still require code review. All reference components, tests, helpers and static assets are present in the file list even when grouped below.

Current implemented modules in the frontend registry: home, messenger, passwords, approvals, admin, profile, notifications. Auth routes live outside the registry. The `src/modules/auth` folder contains the login and token-password pages.

## Route mapping

| Current frontend route | Universal destination | Difference |
|---|---|---|
| `/login` | `/login` | Shared native UI; challenge adapters vary by platform. |
| `/invite/:token` | `/invite/[token]` | Expo Router file route. |
| `/reset-password/:token` | `/reset-password/[token]` | Expo Router file route. |
| `/` | `/` | Capability-aware landing redirects Messenger users to chats and others to Home. |
| `/home` | `/home` | Shared Home screen and capability-filtered tiles. |
| `/messenger` | `/messenger` | Shared conversation list/workspace. |
| `/messenger/:conversationId` | `/messenger?conversation=<id>` | Query-based Universal route; `seq` supports message jumps. Existing notification/custom-link adapters perform allowed destination mapping; arbitrary reference URL parity is not implied. |
| `/share` | `/share` | Explicit Android/PWA incoming-share review; iOS extension disabled until identifiers/signing exist. |
| `/notifications` | `/notifications` | Activity/alerts presentation differs; `view=alerts` opens alert management. |
| `/passwords` | `/passwords` | Vault panel. |
| `/passwords/shared` | `/passwords?view=shared` | Panel rather than nested route. |
| `/passwords/vaults/:id` | `/passwords?vault=<id>` | Panel-based routing. |
| `/passwords/vaults/:id/activity` | `/passwords?vault=<id>&view=activity` | Vault activity view. |
| `/passwords/entries/:id` | `/passwords?entry=<id>` | Entry view; server still checks access. |
| `/passwords/break-glass` | `/passwords?view=break-glass` | Existing emergency access domain actions preserved. |
| `/passwords/admin` | `/passwords?view=admin` | Team vault administration. |
| `/admin/users` | `/admin?tab=people` | Consolidated administration panel. |
| `/admin/users/:id` | `/admin?tab=people&user=<id>` | Person detail within panel. |
| `/admin/groups` | `/admin?tab=groups` | Permission-group panel. |
| `/admin/security` | `/admin?tab=security` | Security policy panel. |
| `/admin/alerts` | `/notifications?view=alerts` | Navigation/placement differs. |
| `/admin/approvals` | Existing `/admin?tab=approvals` | Reference now redirects to the excluded unified inbox; existing Universal administrative approval decisions remain. |
| `/approvals` | **Excluded** | User explicitly requested keeping this page excluded. |
| `/profile` | `/profile` | Profile/security consolidated panel. |
| Unknown route fallback | Expo Router fallback | Full reference fallback semantics not independently validated. |

`/admin/companies` is commented out in the reference module config; Universal still has a limited Companies administration tab. Neither a current reference admin audit-log screen nor a Calls route was found.

## Screens and reusable component mapping

The exhaustive file index is the JSON artifact. This table groups every current frontend component family by its Universal responsibility rather than claiming a one-file-for-one-file port.

| Reference family | Universal counterpart |
|---|---|
| `app/layouts/*`, `core/theme`, `shared/ui/*` | `Workspace`, `WorkspaceChrome`, `ui`, `Brand`, `Icon`, `ChatAvatar`, `Sheet`, persistent ThemeProvider and light/dark/system controls. |
| `auth/pages/*`, `core/auth/*` | Expo auth/token routes, `TokenPassword`, `Session`, `StepUp`, AppLock platform files, auth controllers and adapters. |
| `home/*` | `index`, `homeTiles`, capability rules. |
| `messenger/MessengerPage`, ConversationList, ChatListActions, NewChatDialog, PeoplePicker, UnreadBadge | `Messenger`, `ConversationWorkspace`, `ConversationPicker`, `useCursor`, `LiveUpdates`. |
| ChatView, ChatSearch, MessageList, MessageBubble, MessageSheets, Dialogs, RealtimeBridge | `ConversationWorkspace`, `MessageTools`, `MessageDetails`, `MessagePresentation` ticks/day separators, history/window/reader/realtime controllers. |
| Composer, ComposerExtras, MediaPreview, PreviewText | `ChatComposer`, conversation options, composer state/preview, `CapturePanel`, picker/voice/upload adapters and poll/contact/event/location tools. |
| RichContent, PhotoViewer, Blurhash, ChatSkeleton | `RichMessage`, `MediaPlayback`, `ImageViewer`, `FullImage`, generic loading states; full skeleton/blurhash treatment missing. |
| GroupInfo, ProfilePanel, SharedMedia | `ConversationDetails`, `PersonDetails`, `SharedMedia`, `GroupPhoto`, `SelectedSenders`, `PollVoters`. |
| MapView, LocationEvent, DateTimePicker | `SpecialMessage`, `LocationMap`, `LocationPicker`, `EventComposer`, `EventDateTime`, form/coordinate/ICS helpers and native/web location adapters. |
| SharePage/share/SW receiving code | `/share`, IncomingShareBridge, native intent adapter, ShareReview and durable account-bound retry controllers; PWA multipart intake. |
| messenger hooks/store/live/outbox/lib | Native-independent history/outbox/cache/drafts/reader/lib controllers; platform storage/lifecycle adapters. |
| profile page/components | `ProfilePanel`, `ProfileImages`, `ChatAppearance`, AppLock and auth security adapters. |
| notifications page/components/push/severity | `ActivityPanel`, `AlertsPanel`, `LiveUpdates`, `LiveFeedback`, PushSettings/controller, web VAPID registration and worker click handling; native push deferred. |
| passwords pages/components/lock/clipboard/labels | `VaultPanel`, `VaultTools`, `VaultManagement`, `VaultFiles`, `VaultGate`, SecretCopy platform adapters and password domain helpers. |
| passwords/generator | New Universal generator module/tests and `PasswordGenerator` form component; integrated verification tracked by lead. |
| admin pages/components/groupArea/approvalToast/lib | `AdminPanel`, `AdminManagement`, `AdminPassword`, `AlertsPanel`, admin API and review helpers. |
| approvals page/badge/API | Excluded; existing separate admin/vault decisions remain. |
| shared ImageEditor/imageFile | `PhotoEditor`, `CropSurface`, image model/interaction/edit and frame platform adapters. |
| shared PageHeader/Breadcrumbs/DataState/Pagination/SearchInput/ConfirmDialog/ChoiceDialog/CopyField | Shared native `ui`, `Sheet`, `ResourceList`, cursor/resource controllers and explicit confirm/copy actions. |
| shared PullToRefresh/SwipeToDelete/Skeletons, messenger hold/swipe | Partial native adaptations; complete gestures and loading geometry not equivalent. |
| core/pwa/install/update/externalLinks/ConnectionBanner, `sw.ts` | `PwaSupport.web`, generated `pwa/sw.ts`, install/update, ConnectionStatus, push/click policy, multipart share-target and destination validation. |

## API and protocol inventory

The API is still `/api/jm/` plus `/api/jp/`; unsafe writes use the CSRF cookie/header and authenticated requests use the existing HttpOnly session. REST remains authoritative. The single `/ws/` connection carries the existing JSON protocol; reconnect/RESYNC reconciles sequence windows. No backend endpoints or database models were invented.

At capture time, the exported symbol names in the reference admin, profile, notifications and passwords `api.ts` modules all had counterparts in their Universal modules. This establishes name coverage only: it does not prove equivalent parameter types, error handling, UI accessibility, permissions or execution. Platform upload bodies differ by design. The JSON artifact supplies individual exports and path expressions for review.

| API area | Coverage and gaps |
|---|---|
| Authentication/security | Cookie login/logout, `/me/`, CSRF, MFA, recovery, step-up, sessions and web passkeys represented. Native passkeys not implemented. |
| Messenger directory/conversations/groups/settings/messages | Existing domain functions represented, including seq windows, `client_id` sends, edit/delete/reaction/forward/receipts, polls, contacts, uploads and appearance. |
| Shared history/disappearing/event answers | Current cycle added `getShared`, `setDisappearing`, `answerEvent` and `eventAnswers` plus current response types. |
| Location/map/event mutation | The continuation added the previously absent `EventInput`, `MAP_TILES`, `Place`, `createEvent`, `placeAt`, `searchPlaces`, `sendLocation`, `updateEvent` contracts and their composer/edit/map flows. Unit/browser evidence does not establish live provider/GPS/calendar acceptance. |
| Notifications/push | Browser opt-in/out/test, VAPID registration, account cleanup and worker handling are connected. Live provider/server delivery remains unverified; native push is deferred. |
| Passwords | Vaults/folders/entries/files/shares/members/owner requests/emergency access/activity represented; UI and authority combinations remain incompletely tested. |
| Administration | Users/memberships/recovery/passwords/companies/groups/security/chat policy represented; existing approval flows preserved. |
| Unified approvals | Seven reference exports intentionally absent with the excluded page: `ApprovalItem`, `ApprovalKind`, `ApprovalStatus`, `approvalKeys`, `decide`, `listApprovals`, `useWaitingApprovals`. |

Backend BE-036 supports `(sender, client_id)` idempotency. This avoids duplicate message creation on compatible retries; it is not a proof of exactly-once transport. BE-023 documents `X-JM-Expected-User`, but the expected implementation was not found in current Python source. Universal sends the compatible header and retains its client identity/locking checks, while the cross-client race remains unresolved without a separately authorized backend change.

## State and dependency mapping

| Reference | Universal choice | Consequence |
|---|---|---|
| React19 / TypeScript6 / Vite8 | React19 / strict TypeScript6 / Expo58 / React Native0.88 / React Native Web | Shared Android/iOS/web app; platform-specific adapters isolate browser/native APIs. |
| React Router module registry | Expo Router files and query-parameter panel selection | Route shapes differ; destination mapping must stay explicit. |
| TanStack Query server cache + Zustand client stores | Dedicated observable domain controllers, hooks and React state | Working architecture retained; full query-cache semantics are not automatically inherited. |
| Axios | Axios transport with same-origin web and configured native origin | Cookie/CSRF protocol unchanged. |
| Tailwind/Radix/DOM glass | Native shared primitives and palette | Native fallback surfaces; exact blur/menus/animations require further visual work. |
| Variable Inter / lucide-react | Expo Inter weights / copied Lucide raster assets and license | Original identity retained; icon scaling and full typography parity need review. |
| Leaflet | Shared React Native tile/pan/zoom renderer using JM map proxy; Expo foreground location | Preserves existing provider/API contract; interaction geometry and physical GPS/provider validation remain pending. |
| Workbox/vite-plugin-pwa | Build-generated versioned static allowlist worker plus push and multipart share handlers | Public shell cache stays separate from account-bound incoming-share IndexedDB storage; final expanded worker checks pending. |
| IndexedDB reference outbox | Account-bound IndexedDB web queue; SecureStore native queue/history | Web pending text remains origin-readable plaintext; native history bounded. |
| Browser WebAuthn / clipboard / file inputs | Web adapters; native Expo LocalAuthentication, Clipboard, image/document/contact/audio/video/sharing/file modules | Every native permission and receiver needs device validation. |

The regenerated JSON dependency snapshot includes SDK-compatible `expo-location` (~58.0.20) for foreground location. The existing `expo-sharing` plugin now handles Android incoming intents. Exact versions are also in `package.json`/lockfile; regenerate the inventory after later source/dependency changes.

## Asset inventory

The reference public assets consist of the JM mark and light/dark wordmarks; light/dark favicons (32/48); icon192/icon512/dark512/maskable512/apple-touch/badge96; and `sounds/jm-notify.wav`. The JSON records every asset hash.

Universal reuses the original JM mark/wordmarks, original notification sound and PWA/common native icons. Lucide symbols used by the shared shell are copied as transparent raster assets with their license. Auth backdrop images are rendered from the reference appearance rather than original brand replacements. Full dark icon, monochrome adaptive icon, splash and every icon/animation mapping is not certified. A 512px reference icon is not sufficient evidence for an App Store-ready 1024px icon/signing package.

## Reference/documentation drift

- Current frontend source explicitly uses a phone dialer `tel:` shortcut and says JM has no calling of its own (`ChatView.tsx`); no `modules/calls` folder or registry entry exists. Some design/decision/backend documents still describe WebRTC calls. Source behavior is the migration reference; the discrepancy must be resolved before promising a new calling subsystem.
- Current frontend has the unified Approvals module, but the user expressly excluded it.
- Backend BE-023 describes a mutation guard absent from the inspected Python implementation.
- The earlier isolated smoke database lacks `files_upload.discarded_at` and the `messenger_eventreminder` table; no migrations were made. The subsequent user-authorized two-account test against the running backend passed current production-web messaging/reconnect/reload checks, so this isolated fixture issue is not a blocker for that tested path.

## Next acceptance work

1. Finish integrated current-source static/build/unit/browser checks and retain failures alongside reruns.
2. Reconcile reference screenshots for phone/tablet/desktop and all major sheets/panels; verify persistent theme, compact/immersive chat, receipt/date presentation, motion and accessibility.
3. Validate the landed location/event/map/calendar, Android/PWA share, locked-chat unlock and web-push flows against real compatible services/devices. Native push/passkeys and iOS extensions remain deferred.
4. Resolve isolated fixture schema compatibility outside this no-schema-change cycle for repeatable broad regression testing. Keep the completed authorized real-account messaging check scoped to its observed behavior; event/reminder and full role/permission matrices still need acceptance.
5. Validate protected history/cache recovery and permissions on real Android hardware, then iOS with authorized build infrastructure. Review browser pending-message protection before production release.
6. Choose release identities/domain/signing and verify associated links/passkeys/push before claiming store or production readiness.

## Continuation evidence boundary

The first continuation Android build succeeded in 13 minutes 15 seconds (`test-results/android-build-continuation.log`) and was installed. Against the unchanged local backend configuration, the existing emulator session and conversation list restored and `/ws/` was accepted (`test-results/backend-continuation.log`). Native ACTION_SEND synthetic text opened share review and was discarded without sending. The owned emulator was stopped and display overrides reset. The final APK rebuild adds the multiple-text MIME filter and passed in 12m 9s (368 tasks); `test-results/android-build.json` records its 80,881,314-byte artifact and SHA-256. It was not reinstalled after the preceding native runtime checks.

Those Android observations do not establish fresh native two-account messaging or physical camera/GPS/share-provider acceptance. Separately, the current production web build passed an authorized two-account check against the user's backend: real login/CSRF 204, both WebSocket HELLO messages, cross-account MESSAGE_CREATED, reconnect catch-up, automatic offline queue flush, and reload session/history restoration. Each of the three test messages appeared once in backend results; all were removed and both test sessions logged out. `test-results/live-account-smoke.json` records completion at 10:58:11 UTC with no page errors. The harness is `scripts/live-account-smoke.cts`; scripts and documentation are outside this inventory's source/public scope.

Earlier hot-reload browser failures occurred during active source edits; current TypeScript/lint, 476 application tests across 69 files and 7 tooling tests pass. The stable-source browser/PWA rerun still belongs to [testing.md](../testing.md). Native history remains 10 chats x 40 messages/30 minutes or session expiry; browser history is memory-only, outgoing queue/intake IndexedDB is unencrypted, and cold-start offline authentication is not implemented.
