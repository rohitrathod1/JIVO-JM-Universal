const fs=require('node:fs');
const file='JIVO-063-STATUS.md';let s=fs.readFileSync(file,'utf8');
s=s.replace('## Verified checkpoint after review fixes','## Verified checkpoint after notification, vault and administration parity pass');
s=s.replace('No Git commands were retried in this recovery pass.','No Git commands were retried in this pass.');
s=s.replace('The interrupted sensitive-state edit was confirmed not to have executed: `patch-review.cjs` was an older patch and `src/shared/sensitive.ts` did not exist. New targeted patches were applied only after that check.\n\n','');
s=s.replace('2026-10-20T08:24:16.508Z','2026-10-20T08:45:36.884Z').replace('**16 unit files / 88 tests**','**17 unit files / 96 tests**');
const marker='### Review fixes implemented and verified';
s=s.replace(marker,`### Latest source additions and evidence

- Notification destinations are allowlisted and mapped into shared routes. Conversation links load the specified conversation and message window. Vault, entry, activity, administration and alert targets are mapped; external or malformed targets are rejected. Eight mapping tests and the conversation-link browser flow pass. Native OS link association is unverified.
- Vault source now includes rename/archive, member roles and removal, owner approval requests, team-vault creation/owner administration, cursor-based activity, and emergency request/decision flows. Browser checks cover rename/archive/activity, team-vault creation, pending owner appointments and emergency requests. Decision/removal combinations still need interaction tests; secure vault files remain missing.
- Administration source now includes invitation creation, account lifecycle actions, temporary recovery/invitation links, group assignments and capabilities, device revocation, company memberships, chat restrictions, and two-step policy. Pending-approval responses remain pending in the UI. Sensitive links are guarded against blur/unmount and stale responses. Browser checks cover invitation creation, deactivation, pending reactivation, group assignment/creation, and security-policy approval behavior. Device, membership, chat, recovery and approval-result link branches remain unverified by browser interaction.
- Fresh dependency assessment found no compatible safe fix for the 19 inherited high entries. No package or lockfile upgrade was applied in this pass.

${marker}`);
const rows={
'| Notifications |':'| Notifications | Filters/paging, read/read-all, detail/removal, preferences, allowlisted destination navigation | Mocked notification and conversation-target flows plus eight mapping tests pass. Vault/admin target interactions and native OS links remain unverified |',
'| Vault administration |':'| Vault administration | Rename/archive, team-vault creation, members/roles/removal, local/global owner requests, owner administration, cursor activity, emergency requests/decisions | Mocked rename/archive/activity/create/pending-owner/emergency-request flows pass. Secure files remain missing; approval decisions, member removal and broader permission combinations are source-implemented but interaction-unverified |',
'| Administration |':'| Administration | People metadata/invitations/lifecycle, sensitive reset/invite links, group assignment/capabilities/members, devices, company memberships, chat restrictions, approvals and two-step policy; ADMIN_AUDIT group access | Mocked people edit, invitation, deactivate/pending-reactivate, user groups, group creation and security policy pass. Device/company/chat/recovery/group-member/approval-result-link flows remain interaction-unverified. Direct administrator password setting and broader company lifecycle remain gaps |',
'| Admin audit screen |':'| Admin audit screen | Original `admin/module.config.tsx` explicitly says there is no audit-log screen | No invented admin audit screen. Vault activity is implemented and mocked-browser tested separately |'
};
s=s.split('\n').map(line=>Object.entries(rows).find(([prefix])=>line.startsWith(prefix))?.[1]||line).join('\n');
s=s.replace('Fresh `npm audit --json` is saved as `audit-after-media.json`','Fresh `npm audit --json` is saved as `audit-current.json` (the production-only audit is `audit-production-current.json`)');
s=s.replace('npm proposes downgrading Expo to 44.0.6.','Registry queries confirm latest braces 3.0.3 and node-forge 1.4.0 are still affected. Both full and production-only audits report the same 19 entries because Expo/RN carry tooling through production dependency trees. npm proposes downgrading Expo to 44.0.6 or React Native to 0.72.17.');
s=s.replace('`npx expo install --check` passes after adding SDK-compatible expo-audio and expo-video.','`npx expo install --check` passes again in `sdk-compatibility-current.log`; SDK-compatible expo-audio and expo-video remain installed.');
s=s.replace('## Build history and platform limits','Manual user-only build instructions are in `README.md`. None of those build/prebuild/export commands were executed in this pass.\n\n## Build history and platform limits');
fs.writeFileSync(file,s);
