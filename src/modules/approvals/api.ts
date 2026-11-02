import { api } from '../../core/api/client'
import { endpointFor, type ApprovalDecision, type ApprovalItem, type ApprovalList } from './model'

export type { ApprovalItem, ApprovalList } from './model'

/** GET /api/jm/approvals/?status=pending|all (backend core.approvals.ApprovalsView). */
export const listApprovals = async (status: 'pending' | 'all') =>
  (await api.get<ApprovalList>('/approvals/', { params: { status } })).data

/**
 * POST to the item's own endpoint, so each kind's rules (who decides, two people, step-up) stay the server's.
 * A step_up_required answer is handled by the shared transport + StepUp sheet, then retried once.
 */
export async function decide(item: ApprovalItem, decision: ApprovalDecision) {
  const endpoint = endpointFor(item.actions[decision])
  if (!endpoint) throw new Error('This request has an unexpected action. Open it from its own page.')
  return (await api.post<{ status?: string; result?: { link?: string }; link?: string }>(endpoint.url, {}, endpoint.base === 'jp' ? { baseURL: '/api/jp' } : undefined)).data
}

// Badge refresh: the screen announces decisions so the navigation count updates without waiting for the poll.
const listeners = new Set<() => void>()
export function onApprovalsChanged(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function approvalsChanged() { listeners.forEach(listener => listener()) }
