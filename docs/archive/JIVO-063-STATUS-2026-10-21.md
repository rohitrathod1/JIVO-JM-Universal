# JIVO-063 - source migration status

## Latest source checkpoint - 2026-10-21T05:49:58.588Z

Universal only. TypeScript, uncached warning-free lint, **40 test files / 265 tests**, all four mocked Edge viewports (360x1000, 768x1000, 1440x1000, 844x390) and the cross-tab/legacy-outbox suite passed via node verify-current.cjs. Final source/config/documentation hashes are recorded by capture-verified-source.cjs and checked by verify-final-hashes.cjs. No native validation or production-readiness claim.

- Fixed reviewed app-lock defects: initial/sync storage read failure fails closed with recovery UI. Cancel/background/relock/unmount invalidate status, options and credential requests; password state clears and only a current foreground generation can unlock. Deferred status/options and stale-success tests pass.
- Added explicit web copy of revealed secrets and existing copy-event reporting. Reveal is bounded by server expiry and 30 seconds. Synthetic tests cover lifecycle invalidation, repeated actions, denial/audit errors and preservation of replacement clipboard data. No actual clipboard was used.
- Automatic OS clipboard clearing is **unavailable**, not implemented: separate browser read/write operations cannot guarantee ownership at deletion time. No empty-string timer/background writes or OS clipboard reads were added. Native copying remains unavailable pending a validated adapter. See CLIPBOARD-LIFECYCLE.md for the exact API limitation and manual review steps.
- Dependency state is unchanged: 20 high package entries, SDK compatibility passed at the prior dependency assessment; no dependency addition or unsafe override in this pass.

Remaining source and integration gaps are in REMAINING-PARITY.md and FEATURE-PARITY-CHECKLIST.md. Original frontend/backend and production remain untouched; no builds/exports, real backend calls, credentials or device permissions used.


## Historical source checkpoint - 2026-10-21T05:40:43.143Z

Universal only. Final aggregate: TypeScript, uncached lint without warnings, **38 test files / 250 tests**, mocked Edge **360x1000, 768x1000, 1440x1000, 844x390**, and isolated two-tab/legacy-outbox regression. Commands: node verify-current.cjs; node reassess-dependencies.cjs; node capture-verified-source.cjs; node verify-final-hashes.cjs. See test-results/verification-latest.json, stage logs, editor screenshots and final manifest. This is source/mock evidence, not native validation or production readiness.

- Reconciled current October 21 reference behavior: passkey-first verification, offered password fallback and cancellation, automatic vault entry unlock and ten-minute idle lock; later web device passkey lock with five-minute background relock. See REFERENCE-UPDATE-2026-10-21.md; no exact historical diff is claimed.
- Completed messenger attachment export source: explicit review, fresh message/ready-attachment access, restricted authenticated URL, abortable 120-second download, safe filename and native handoff in separate owned cache. Tests cover successful synthetic download, cancellation without a Blob URL, stale/deleted/denied access and cache isolation from vault exports. Native 20 MiB/process/receiver limits remain.
- Completed shared crop dragging/corner resize, aspect presets, zoom, transformed preview, rotation/flips/reset and web frames. Native frame source uses react-native-view-shot 6.1.1 to capture only the edited image view after Apply, with owned output cleanup and late-result rejection. No native frame capture ran. Exact differences are in FEATURE-PARITY-CHECKLIST.md.
- Fixed reviewer findings: validity checks after every native camera/contact permission/picker/details await; cancelled work cannot open another surface/read details. Recorder cleanup independently attempts file deletion, native release and audio-mode reset, aggregates errors and retains unfinished steps for retry. Nine actual-adapter dependency mocks pass.
- Reassessed dependencies: **20 high package entries, 0 moderate/critical** in full and omit-dev audits; SDK check passes. The extra view-shot entry inherits the existing react-native chain; direct advisory roots remain braces and node-forge. No safe compatible fix identified, forced downgrade or suppression applied.
- Added FEATURE-PARITY-CHECKLIST.md and REFERENCE-SOURCE-INVENTORY.json covering original module/page/component families. Source completeness, partial behavior and integration prerequisites are separated. Native assessment now distinguishes vault provider reads from owned messenger/profile picker copies.

Still missing: protected durable native outbox, native passkeys, browser/native push and OS link integration; several original notification/contact/poll/media/gesture interactions and exhaustive permission coverage. Cross-client session races need server-side expected-principal binding; backend was not changed. Manual native validation/builds remain user-owned. Original frontend/backend, credentials, services and production were untouched.


## Historical source checkpoint - 2026-10-20T11:17:26.969Z

Universal only. Latest aggregate passed TypeScript, uncached ESLint with no warnings, **30 unit files / 196 tests**, four mocked Edge viewports (**360x1000, 768x1000, 1440x1000, 844x390**) and the isolated two-tab browser regression. Commands: node verify-current.cjs; node reassess-dependencies.cjs; node capture-verified-source.cjs; node verify-final-hashes.cjs. Evidence: test-results/verification-latest.json and stage logs; the manifest records the final source, documentation and dependency evidence. No builds, exports, live backend calls, credentials, or actual device permissions were used.

- Closed reviewed cross-tab outbox defects: shared auth-change notifications freeze/abort queues, Web Locks coordinate this client's login/logout and delivery, every send revalidates authenticated identity, transactional per-entry storage and tombstones prevent snapshot overwrite/resurrection, and logout invalidates stale storage leases. Synthetic browser tests cover concurrent enqueue/discard/delivery/logout, legacy-key migration, page reload persistence, shared-cookie A-to-B mismatch blocking and auth/send ordering. This does not establish an atomic backend account precondition against unrelated clients changing cookies outside this coordination protocol.
- Closed picker lifecycle defects: native selected documents are copied into an owned cache directory, with cleanup handles; stale/replaced/cancelled/completed/unmounted selections are disposed. Profile/group photo selection uses generations. Native provider and cleanup behavior remains device-unverified.
- Added profile/group image crop percentages, rotation, flips, PNG conversion, web frame effects, group avatar upload/removal and restored the 16 MB photo limit (8 MB backgrounds). Edited outputs are revalidated. Native frames and the original drag/zoom/live transform preview are still missing.
- Added explicit voice recording/review (60-second maximum), camera photo capture, selected phone-contact/vCard import and review before attachment upload. Permission requests occur only from action buttons; background/cancel invalidates pending work. Browser tests use synthetic media/contact objects and generated files; native cleanup tests use mocked filesystems. No real recording, camera, contact or sensitive export occurred.
- Added conditional browser install-prompt UX with dismissal/retry/installed states. Tests dispatch synthetic events; installability, service-worker/offline packaging and actual installation are unverified.
- Added exact SDK-compatible expo-image-manipulator 58.0.15 and expo-contacts 58.0.8. Final full and omit-dev audits remain **19 high, zero moderate/critical**; Expo compatibility passes. No forced upgrade or advisory suppression.

Native durable outbox remains deliberately memory-only. Native passkeys remain unavailable. See REMAINING-PARITY.md for exact source and integration gaps. Source/mock verification is not Android/iOS validation or blanket feature parity.


## Latest source parity checkpoint — 2026-10-20T10:31:24.094Z

Only Universal was edited. Final aggregate verification passed: TypeScript, uncached ESLint with no warnings, **24 unit files / 168 tests**, and synthetic Edge flows at **360x1000, 768x1000, 1440x1000 and 844x390**. See test-results/verification-latest.json, stage logs and the refreshed verified-source-manifest.json. No native build, live integration or real credentials were used.

- Added capability-filtered home tiles and header navigation; login still opens Messenger.
- Added original mention tokens/suggestions, plain-text rich links and server previews, typing/presence, receipt/reaction details, and selected-member send controls with fresh membership checks.
- Added account-bound queued/sending/failed outbox, stable client IDs, sequential retry, manual retry/discard, foreground/reconnect resume and sign-out cancellation. Browser IndexedDB stores unsent message payloads and clears on sign-out; native is explicitly memory-only. Unit tests cover restoration, owner replacement, storage failure, ordering, cancellation and late responses. Browser tests cover failed send/manual retry. Browser reload restoration remains integration-unverified.
- Added scanned profile image upload/removal, organization background color/image/reset/removal source and background rendering. Mocked image upload/removal and color update pass. Advanced image editing, broader format conversion and the original 16 MB photo allowance remain incomplete (current supported photo limit 10 MB; background 8 MB).
- Added direct administrator password entry with target confirmation, fresh account checks, abortable verification, immediate/approval-pending outcome handling and clearing on blur/cancel/completion. Only synthetic strings were submitted to mocks. Both response branches pass browser tests.
- Fixed theme subscription race with useSyncExternalStore and queued outbox delivery through the history event guard. Added Home screenshots for each responsive viewport.
- No dependency manifest/lock changes in this pass. Refreshed full and omit-dev audit: **19 high, zero moderate/critical**; Expo SDK compatibility passes. Existing advisory qualifications and native export/passkey caveats remain.

This is a source-only checkpoint, not full feature parity or Android/iOS validation. Exact remaining source and test gaps are in REMAINING-PARITY.md.


## Historical 09:59 checkpoint after native export and reviewer fixes

Work is confined to `C:\Users\JIVO\Desktop\JIVO\JM\JIVO-JM-Universal`. The original frontend and backend remain read-only references. No Git commands were retried in this pass.

The previous 09:59 checkpoint passed 141 tests and the four mocked viewport flows. It is superseded by the latest source checkpoint above.

### Native export and reviewer fixes

- Implemented native vault export using exact SDK-supported expo-file-system 58.0.10 and expo-sharing 58.0.19. Explicit confirmation, 20 MiB preflight/conversion limit, bounded safe filenames, isolated temporary cache, single-export control, expiry and cleanup are source-implemented. Synthetic unit tests verify cleanup/error/cancellation paths; no actual native export or device validation ran. Interrupted process cleanup and receiver-copy limits are documented in NATIVE-INTEGRATION-ASSESSMENT.md.
- Fixed JSON Blob error decoding before step-up, preserving session-generation and one-retry guards. Cancelled verification does not retry; aborted requests remove their pending verification prompt. Native FileReader fallback handles platforms without Blob.text().
- Download and preview now accept AbortSignals. Blur, unmount and user cancellation abort them; downloads have a 120-second request timeout. Mocked browser tests verify successful Blob step-up retry, verification cancellation, button/blur cancellation of delayed downloads and no new Blob URL from cancelled responses.
- Fixed sheet portal mounting so a newly opened step-up dialog is accessible above a file confirmation. The regression uses the active dialog rather than a hidden retained Profile field.
- Approval confirmation now shows target name/email, requester name/email, requested/expiry times, reason and action-specific consequences, including the original account-recovery restriction. Submit rechecks authority and rejects changed target/action identity. Mocked confirmation checks pass.
- Full and production-only dependency audits were rerun after the module additions: both remain 19 high, zero moderate/critical; SDK compatibility passes. No forced upgrades or suppressed findings.
- REMAINING-PARITY.md reconciles genuine missing source features separately from implemented-but-unverified integrations and interaction gaps. This is not full original-feature parity.

### Previous 09:36 vault-file and administration checkpoint

- Reconnection reconciliation found all 101 saved hashes matched the 08:45 checkpoint. The interrupted report script had not executed; it was safely completed. Exact Expo CLI and Metro-config versions are recorded in DEPENDENCY-TRIAGE.md.
- Added shared vault file listing, raw upload/progress/cancel, temporary decrypted preview, rename and delete; web download requires confirmation. Every operation rechecks current server permissions. Preview expiry uses the server interval capped at 60 seconds; foreground generations reject late previews and downloads. No new package or lockfile changes.
- Mocked browser tests now cover file upload body/headers, rename and fresh permission denial, deletion, download filename, preview expiry, and a late preview after blur. Native URI reads and authenticated transfers remain unverified; native export was unavailable at that checkpoint and is now source-implemented as described above.
- Additional admin browser tests cover individual device revocation, company membership add/default/remove, chat restrictions and allowed-person add/remove, group-creation policy, approval approve/deny/cancel and clearing approval-generated access links on blur.
- Native passkey feasibility and file platform limits are documented in NATIVE-INTEGRATION-ASSESSMENT.md. Native passkeys remain unsupported; no native bridge, domain/server settings, credentials or builds were introduced.

### Earlier source additions and evidence

- Notification destinations are allowlisted and mapped into shared routes. Conversation links load the specified conversation and message window. Vault, entry, activity, administration and alert targets are mapped; external or malformed targets are rejected. Eight mapping tests and the conversation-link browser flow pass. Native OS link association is unverified.
- Vault source now includes rename/archive, member roles and removal, owner approval requests, team-vault creation/owner administration, cursor-based activity, and emergency request/decision flows. Browser checks cover rename/archive/activity, team-vault creation, pending owner appointments and emergency requests. Owner decision/removal combinations still need interaction tests; file workflows now have separate coverage below.
- Administration source now includes invitation creation, account lifecycle actions, temporary recovery/invitation links, group assignments and capabilities, device revocation, company memberships, chat restrictions, and two-step policy. Pending-approval responses remain pending in the UI. Sensitive links are guarded against blur/unmount and stale responses. Browser checks cover invitation creation, deactivation, pending reactivation, group assignment/creation, and security-policy approval behavior. Recovery actions and broader group-member branches remain unverified; device, membership, chat and approval-result link branches were covered in the latest pass.
- Fresh dependency assessment found no compatible safe fix for the 19 inherited high entries. No package or lockfile upgrade was applied in this pass.

### Review fixes implemented and verified

- Recovery-code enrollment/regeneration responses carry a generation and foreground guard. Blur/background, close, and unmount invalidate older requests; requests begun while inactive cannot later display codes.
- Sensitive vault views clear on web window blur and visibility loss through a separate adapter. Realtime lifecycle behavior is unchanged.
- Open image/audio/video views resolve from their originating conversation, message and attachment IDs. Deletion, hidden messages, selection changes and confirmed access loss dismiss them. History clears on resource denial/removal and ignores late responses. Network/server failures, CSRF errors and step-up challenges retain the loaded history.
- Named custom fields with blank values are omitted. Explicit stored-field removal sends null, matching the original form's API semantics.
- Share/revoke/move confirmation branches and submit handlers check permissions; submissions fetch current entry permissions before mutation. The backend remains the authority for authorization.
- Incoming messages follow readers near the live end. Readers further up keep their position and receive a new-message action. Measured list height avoids inaccurate estimated end offsets; history anchoring is released for explicit latest jumps.

Regression evidence includes delayed recovery responses after blur/refocus, transient versus denied history responses, late-response rejection, blank-value omission/deletion semantics, fresh permission denial before mutations, media dismissal on deletion and access loss, vault blur clearing, batch arrivals, preserved reader position and jump-to-latest. The browser harness waits for processed reader state before injecting the next arrival.

**User instruction: source code and responsiveness only. The user will build manually. No platform builds, prebuilds, exports, pushes, deployments, service operations, database operations, real backend requests or production changes were performed in this pass.**

The migration remains incomplete. The checklist below distinguishes implemented source from missing parity and unvalidated platform integration. Earlier failed or partial verification runs do not override this final result; future source changes require new verification.

## Feature parity checklist

| Area | Implemented source | Verification / remaining gaps |
|---|---|---|
| Home landing | Greeting, capability-filtered tiles and header Home link | Capability unit tests and responsive Home navigation/screenshots pass; login still opens Messenger |
| Shared application | Expo 58, RN 0.88, React 19.3, RN Web, Expo Router, native primitives, safe areas, light/dark JIVO palette, local Inter fonts, desktop/sidebar and mobile/landscape layouts | Current mocked responsive checks pass. Not pixel-identical; native font scaling and device ergonomics unverified |
| Authentication | Cookie/CSRF transport, restoration, logout/login serialization, session-boundary response guards, password login, recovery MFA, web passkeys, password/passkey step-up, invite/reset links | Mocked password/step-up/invite/reset flows and race tests pass. Native cookie/WebSocket sharing and live CSRF policy need authorized device integration |
| Native passkeys | Explicit unsupported-path UI | Credential-provider bridge and relying-party/domain association not implemented; never bypassed. See NATIVE-INTEGRATION-ASSESSMENT.md for feasibility and required evidence |
| Conversations | Filter/search, guarded cursor paging, direct/group creation, bounded earlier/newer history, reader-aware arrival following/indicator, jump/search, replies/edit/delete/reactions, read/delivery updates, queued realtime mutations, reconnect reconciliation | Unit history/paging tests and mocked send/edit/search/group flows pass. Mentions/typing and receipt/reaction UI have mocked coverage; presence privacy combinations and server link-preview variations remain integration-unverified |
| Groups | Title/description, member addition with history choice, roles/removal, everyone/admin/selected send modes, mute, clear and leave confirmation | Mocked edit/role/add/mute/clear pass. Selected-sender submission is mocked; group photo editing and broader owner/permission cases remain |
| Media | File picker, upload/progress/cancel, scan gating, full-image opening, Expo audio/video playback, pause on background, same-origin media guard | Mocked WAV decoding/play/pause passes. Video decoding, native authenticated media, voice recording, secure native downloads/sharing, cache cleanup and camera workflow remain |
| Profile/security | Editable profile, email request/cancel, password, device sessions/revocation, web passkeys, memory-only recovery codes with request-generation/foreground guards | Mocked profile/step-up passes; photo upload/removal and organization appearance are implemented; advanced photo editing and original web install prompt remain missing; full device/passkey integration remains |
| Notifications | Filters/paging, read/read-all, detail/removal, preferences, allowlisted destination navigation | Mocked notification and conversation-target flows plus eight mapping tests pass. Vault/admin target interactions and native OS links remain unverified |
| Alerts | Active/history/sent lists, dismissal, capability-gated selected/all composition with review, cancel/remove | Mocked review/send/cancel passes. Live delivery/push remains untested |
| Vault entries | Vault/folder/entry browsing, search/paging, shared-entry list, create/edit, native custom-secret fields, unlock/reveal expiry/background/window-blur clear, previous-version reveal, trash/restore, share/revoke, move, folder management | Mocked reveal/expiry/version/create/share/revoke/move/folder creation pass. Shared-entry list and every permission combination are not yet interaction-tested |
| Vault files | Shared list/upload/preview/rename/delete, confirmed web download, cancellable requests and native file/share adapter with guarded staging/cleanup | Mocked responsive file/step-up/cancellation checks pass. Native export has synthetic adapter/controller tests only; native upload, OS handoff, filesystem behavior and authenticated requests remain device-unverified. 20 MiB native limit and process-interruption limits are documented |
| Vault administration | Rename/archive, team-vault creation, members/roles/removal, local/global owner requests, owner administration, cursor activity, emergency requests/decisions | Mocked rename/archive/activity/create/pending-owner/emergency-request flows pass. Owner approval decisions, member removal and broader permission combinations are source-implemented but interaction-unverified |
| Administration | People metadata/invitations/lifecycle, sensitive reset/invite links, group assignment/capabilities/members, devices, company memberships, chat restrictions, approvals and two-step policy; ADMIN_AUDIT group access | Mocked people edit, invitation, deactivate/pending-reactivate, user groups, group creation and security policy pass. Device revocation, company add/default/remove, chat access, approval identity/consequence review and decisions/result-link blur clearing pass. Recovery/group-member flows remain interaction-unverified. Direct password immediate/pending branches now pass mocks; broader company lifecycle is not part of visible original parity |
| Admin audit screen | Original `admin/module.config.tsx` explicitly says there is no audit-log screen | No invented admin audit screen. Vault activity is implemented and mocked-browser tested separately |
| Offline/push | Visible errors/retry, foreground lifecycle handling | No persistent outbox, full offline cache, APNs/FCM registration or native notification integration |

## Review fixes completed

- Sign-out remains pending until its server attempt and cleanup settle; new login waits. Stale 401/step-up operations cannot act on a replacement session.
- Scoped realtime events preserve loaded history. Earlier/newer navigation remains available at the 1,000-message cap. Search jumps work when content dimensions do not change; local delete/clear results update immediately.
- Conversation/people paging guards concurrent and stale responses and deduplicates IDs. Resource loads no longer display results owned by a previous query.
- Bounded keyboard-aware sheets replace unbounded dialogs. Unnecessary modal fades were removed. Compact landscape list/composer layouts keep controls reachable.
- Both themes use #15803D behind white button text.

## Dependency assessment

Fresh `npm audit --json` is saved as `audit-current.json` (the production-only audit is `audit-production-current.json`): **19 high, 0 moderate, 0 critical**. These are dependent package entries arising from two underlying advisories: braces <=3.0.3 and node-forge <=1.4.0. Their reviewed advisories list no patched versions:

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-86w9-cpqp-85rv

Registry queries confirm latest braces 3.0.3 and node-forge 1.4.0 are still affected. Both full and production-only audits report the same 19 entries because Expo/RN carry tooling through production dependency trees. npm proposes downgrading Expo to 44.0.6 or React Native to 0.72.17. This is incompatible with the SDK 58 migration and was not applied. No forced fixes or advisory suppressions were used. Earlier narrow `xcode > uuid` override to 11.1.1 removed seven moderate entries; its UUID call was smoke-tested. The remaining observed paths are Expo/Metro tooling dependencies; that observation is not proof of zero shipped-app reachability. See `DEPENDENCY-TRIAGE.md` for the package-level investigation.

`npx expo install --check` passes again in `sdk-compatibility-current.log`; SDK-compatible expo-audio and expo-video remain installed; exact expo-file-system 58.0.10 and expo-sharing 58.0.19 were added for native export. Playback config disables microphone, background recording/playback and picture-in-picture permissions/features. No native project generation was run for these additions.

Manual user-only build instructions are in `README.md`. None of those build/prebuild/export commands were executed in this pass.

## Build history and platform limits

The earlier Android assembleDebug attempt failed in react-native-worklets CMake/Ninja path creation and was cancelled, returning exit code 1. No APK was confirmed. No Windows path workaround or build restart occurred. `android-build-progress.txt` retains the diagnostics.

Old `dist/` exports and preview screenshots are stale artifacts. Earlier Hermes exports were JavaScript bundle checks, not native validation. No iOS compilation/device validation occurred; this Windows host lacks macOS/Xcode. User builds must incorporate the current config/native modules and choose final app IDs/signing.

Native session cookies, CSRF rotation, logout, WebSocket and protected media access require an authorized non-production server and actual Android/iOS clients. None were supplied or contacted. Backend compatibility issues must be reported without changing the backend. Native passkey associations and APNs/FCM compatibility are unresolved. No backend/OpenBao secret or bearer-token persistence was introduced.

## Reference integrity

The original checkout was previously observed clean on phase-5 at 08e985fff63655637c6fa8d4bed7daf73f016a9d in successful read-only checks. No intentional original source/Git writes were made. No denied Git operation was retried during this recovery. Production operation was reported by the user and not independently verified.
