# Current reference reconciliation — October 21

The reference was read only. Four files have October 21 modification times: StepUpDialog, its tests, LockGate and SecretField tests; exact timestamps/hashes are in the accompanying JSON. There is no complete October 20 reference snapshot, so these are observed current behavior and timestamps, not a claimed exact historical diff. Comparison against today's 2026-10-21T05:13:56.533Z inventory found 3 changed files.

Current StepUpDialog prefers an offered passkey and starts it once; cancellation is quiet, password fallback is available only when offered, and switching cancels the ceremony. Password-only requests do not submit automatically. Universal now follows those rules using a queued flow, abort signals and request/session generation guards. Native passkeys remain unavailable.

Current LockGate starts the existing /api/jp/unlock/ request once on locked-page entry. Cancellation leaves it locked; explicit Unlock retries. Universal now implements that page gate and the existing ten-minute inactivity lock. Existing /auth/step-up/options/, /auth/step-up/ and /api/jp/unlock/ contracts are reused; no backend or domain settings changed. Synthetic regression coverage checks auto-start, fallback, cancellation, stale completion, request scope, idle lock and retry. Real WebAuthn/native integration is unverified.

The SecretField tests reinforce cancellation/locked behavior. Universal entry reveal and explicit web copying with copy-event reporting are implemented and covered by synthetic tests. Automatic OS clipboard clearing and native copying remain unavailable; no timer/background empty write is used. An already-submitted browser write cannot be cancelled and may complete after the view closes. Copied values may remain in OS clipboard history or sync; automatic deletion is not promised. See CLIPBOARD-LIFECYCLE.md for the ownership limitation and manual review steps.

## Later concurrent reference update

At 05:27 UTC the reference added appLock.ts, AppLockGate.tsx and tests, and changed security.ts, main.tsx and profile/AppSection.tsx. The three existing-file changes are confirmed against today's recorded hashes; the new app-lock source files were absent from that inventory. Current backend identity/stepup.py and models declare app_unlock with passkey/password methods, one-minute grant and no authorization for other scopes. This was read only; deployed support is not verified.

Universal now implements the web per-account device preference, passkey confirmation before enabling, initially locked reload, five-minute background relock, cross-tab preference changes, offered-method verification and cancellation. Failed persistence does not advertise enabled. Removing MFA/passkeys disables the setting after a fresh security-status read; unavailable status keeps the screen locked. Session change/unmount aborts outstanding verification. Native app lock is explicitly unavailable until native passkeys can be integrated. Unlike the current reference, Universal conservatively locks after a fresh sign-in when that account preference is enabled. This privacy screen is not encrypted storage or a server authorization boundary. Existing session/outbox services remain active behind it.

Synthetic model/browser tests cover storage failure, repeated visibility events, cross-tab preference changes and reload unlock. No real biometric prompt or credential was used. Newly added passkey-device automatic-login hint behavior is not implemented in Universal; sign-in remains explicitly initiated.

Final read-only reference comparison at 2026-10-21T05:41:18.339Z: 0 changed tracked files since the reconciled reads.

The device lock unmounts routed views; unlocking can return navigation to Home. Unsaved screen-local edits are not retained through locking. Returning to Profile after unlock is explicitly exercised in the browser regression.

Final read-only reference comparison at 2026-10-21T05:50:06.751Z: 0 changed tracked files since the reconciled reads.

The device lock unmounts routed views; unlocking can return navigation to Home. Unsaved screen-local edits are not retained through locking. Returning to Profile after unlock is explicitly exercised in the browser regression.
