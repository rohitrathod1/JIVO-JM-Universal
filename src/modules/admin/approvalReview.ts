import type { Approval } from './api'
export function approvalConsequence(item: Pick<Approval, 'kind' | 'target'>, choice: 'approve' | 'deny' | 'cancel') {
 if (choice === 'deny') return 'The requested action will not run. The requester is told it was denied.'
 if (choice === 'cancel') return 'Withdraw this request without performing the requested account or policy change.'
 const actions: Record<Approval['kind'], string> = {
  reset_password: 'Create a single-use password reset link for this person.',
  reset_mfa: 'Reset this person’s two-step verification credentials.',
  reactivate: 'Reactivate this account so the person can sign in again.',
  restore: 'Restore this deleted account.',
  two_step_off: 'Stop requiring two-step verification for the organisation.',
 }
 return `${actions[item.kind] ?? 'Perform the requested sensitive action.'} ${item.target ? 'Passwords and administration are paused for 24 hours and until the person signs in with a passkey. ' : ''}This runs as you and is recorded. The server enforces the two-person rule.`
}
