# Browser push integration

Implemented only inside Universal. Native APNs/FCM registration remains unavailable until app credentials and platform configuration are supplied.

## Behavior

- Notification preferences provide **Enable device notifications**, **Disable device notifications**, and **Send test notification**. Permission is requested only from the explicit Enable action.
- `webPush.bind(owner)` changes the account epoch immediately. `webPush.sync()` restores a remembered opt-in only when permission is already granted. `bind(null)` invalidates pending prompts and performs endpoint cleanup.
- Web Locks serialize registration/cleanup with the existing shared-cookie login/logout lock. API writes recheck `/me/`; cleanup checks the stored account and endpoint before unsubscribing, so stale work for one account does not revoke another account's newer endpoint.
- The per-account opt-in and current endpoint binding are browser preferences. No credentials or message contents are stored there. Signing out clears the active endpoint but retains the person's opt-in for their next sign-in.
- Missing HTTPS/localhost, browser support, storage, service worker, permission or backend VAPID setup is reported in the preference UI. A registration failure is not presented as success.
- The service worker accepts bounded text/options, uses local icon assets, maps original backend links into Universal routes, suppresses a duplicate only for the focused open conversation, and focuses an existing app window on click. Queued push events after browser unsubscribe are ignored.
- The worker receives the same `notificationTarget` and `pushPolicy` implementation as the app via the production build, avoiding a second independently maintained link mapper. The share-target worker remains separate.

## Source map

`modules/notifications/pushController.ts` owns account epochs and operation ordering. `webPush.web.ts` adapts browser subscriptions, VAPID, API verification, preferences and the shared lock; `webPush.ts` is the native no-op lifecycle adapter. `PushSettings.web.tsx` provides controls; the native `PushSettings.tsx` states the missing native integration. Root integrates lifecycle calls in `core/auth/Session.tsx`.

`pwa/sw.ts` owns delivery/click/rotation events. `shared/pushPolicy.ts` and `notificationTarget.ts` sanitize links and payloads. `PwaSupport.web.tsx` validates worker messages before routing. `scripts/build-web.cts` includes these policy helpers in the classic worker and build digest.

## Verification and limits

The final targeted run in this role passed **73 tests across 7 files**: theme persistence, safe post-login routing, push lifecycle races, real browser-adapter logic with simulated browser APIs, notification policy and the actual compiled worker handlers. App TypeScript, PWA TypeScript, and targeted ESLint passed. These are deterministic unit/integration simulations; they do not prove delivery through an external browser push service.

Actual VAPID delivery, OS notification display, browser permission UX, iOS installed-PWA delivery, and delivery after a real browser restart still need a configured deployment and platform testing. Final production export and full browser regression are owned by the main integration run. Browser endpoints remain subject to the existing backend's session and subscription contract; no backend changes were made.
