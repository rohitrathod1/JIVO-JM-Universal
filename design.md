# Universal migration design

Scope: the 2 November 2026 migration and its authorized continuation. All changes stay in Universal. Frontend and Backend are read-only references. The user explicitly excluded the unified `/approvals` page; existing administration and vault approval actions remain.

This is an incremental migration of the existing strict TypeScript application. Rewriting its working session, messaging, vault and administration code would discard verified behavior. Full production and visual parity are **not yet achieved**. See [testing.md](testing.md) for current evidence and [FEATURE-PARITY-CHECKLIST.md](FEATURE-PARITY-CHECKLIST.md) for the acceptance checklist.

## Shared architecture

| Layer | Implementation | Responsibility |
|---|---|---|
| Routes | `src/app/*.tsx`, Expo Router | Shared Android, iOS and browser entry points |
| Presentation | `src/components`, `src/ui.tsx` | React Native components, responsive workspace, sheets and platform adaptations |
| Identity | `src/core/auth`, `src/core/api` | Existing cookie sessions, CSRF, step-up, account boundaries and native cookie bridge |
| Real time | `src/core/realtime` | Existing `/ws/` protocol, HELLO watchdog, heartbeat, reconnect and lifecycle cleanup |
| Messenger | `src/modules/messenger` | Typed API contracts, seq-based history, durable outbox, drafts and receipt reconciliation |
| Storage | `src/core/storage`, messenger storage adapters | Chunked protected native snapshots; account-bound IndexedDB browser outbox; memory browser history |
| Other modules | profile, passwords, admin, notifications, sharing | Existing backend capabilities, incoming-share review and business rules |
| Device preference | `src/core/theme` | Persisted light/dark/system choice; browser cross-tab updates and native storage |
| Web deployment | `scripts/build-web.cts`, `pwa/sw.ts` | Production export and allowlisted public shell cache |

REST is authoritative. WebSocket events update loaded windows or trigger reconciliation. Stable `client_id` values and the server's documented sender/client deduplication support retries; they are not an unconditional exactly-once guarantee. No backend routes, models or schema were changed.

## Visual mapping

The reference colors, JM ribbon mark, wordmarks, Inter fonts and Lucide icon shapes are copied/mapped into native components. Light/dark canvases use `#F6F8F6`/`#0C1210`; chat surfaces and outgoing bubbles follow the reference. Desktop navigation uses a 72px rail; phone chats use immersive chrome, a compact composer and action menus. Message presentation includes date separators and accessible sent/delivered/read ticks. Capability-aware root routing opens Messenger or Home, and `/home` remains directly accessible. The original auth backdrop is captured as a local image. Responsive images are an approximation of the original CSS gradients, not a claim of pixel identity.

Shared native components preserve actions and accessibility labels. Dialog geometry, all hover/keyboard/gesture states, skeletons, map interactions and every module's detailed layout still need acceptance against equivalent reference screenshots. Visual evidence and limitations are in [docs/UI-PARITY-2026-11-02.md](docs/UI-PARITY-2026-11-02.md).

## Current functional mappings

The continuation adds the complete client flow for locked-chat list/settings/unlock, using the existing server step-up endpoint and an account-bound memory gate. Backgrounding for five minutes, account/session boundaries and session expiry relock or conceal sensitive views. Locked messages stay out of persistent recent-history snapshots even while the display gate is open.

Events now support create/edit/cancel, custom date/time selection, optional end/place/meeting link/reminder, RSVP/counts/answers and ICS calendar export. Locations use JM's authenticated map-tile/search/reverse endpoints, a shared native tile renderer, explicit place review, and browser or Expo foreground location. The same picker supplies event places. These are implemented client flows; physical GPS, calendar receivers and real server reminder delivery remain unverified.

`/share` receives Android/PWA text, links and files into an explicit review screen. Up to five eligible unlocked chats may be selected; the account-bound plan, stable message IDs and upload keys are persisted before sends. Nothing is sent merely by receiving an OS intent. Browser intake storage is separate from the public shell cache. Android uses Expo's experimental receiving API; iOS receiving is disabled without app-group/signing identifiers. See [docs/INCOMING-SHARING.md](docs/INCOMING-SHARING.md).

Web push now has opt-in/out/test controls, account-bound VAPID registration/cleanup and service-worker push/click handling. Browser support, an installed service worker and existing backend push configuration are required. Source/unit coverage does not prove live provider delivery; native push remains deferred. Original/reference dialer behavior uses `tel:` rather than a new JM calling service.

## Offline and privacy boundaries

A send becomes visibly queued only after storage accepts it. A failed persistence attempt retains the composer text. Retries preserve the ID and use capped exponential delay. Authenticated native sessions can reopen a small protected recent-history cache: 10 chats, 40 messages each, at most 200,000 serialized characters, expiring at 30 minutes or session expiry. Locked, expired and revoked content is excluded or invalidated. Cache access never substitutes for server authentication.

Cold start while unable to validate the session remains locked. Browser/PWA shell caching is persistent, while browser recent-history caching remains in memory. Browser queued message content and pending incoming share intake are persistent in IndexedDB and are **not application-encrypted**; this is a remaining shared-device/privacy limitation. Media bytes and vault secrets are not placed in the service-worker cache. Background delivery requires the app to be open/resumed; unrestricted OS background execution is not claimed. Details: [docs/OFFLINE-SYNC.md](docs/OFFLINE-SYNC.md).

## Platform boundaries

The existing local Android application ID and custom scheme remain. Original branding is configured for common and Android adaptive icons. The final Android debug build passed in 12m 9s. The preceding continuation APK covered existing-session/share review; the final APK was subsequently installed and passed native send/receive against two authorized accounts. Current static/unit/tooling checks pass, while stable-source responsive browser, cross-tab and PWA checks also pass in [testing.md](testing.md). No public domain, final identifiers or signing credentials were supplied. Native passkeys, verified links, push, store builds, iOS compilation and real-device acceptance therefore remain separate requirements. Follow [docs/PLATFORM-DEPLOYMENT.md](docs/PLATFORM-DEPLOYMENT.md), and use [testing.md](testing.md) before treating any build as a release candidate.
