export function confirmedAccessLoss(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { code?: string } } })?.response
  if (response?.status === 404 || response?.status === 410) return true
  return response?.status === 403 && !['step_up_required', 'csrf_failed'].includes(response.data?.code ?? '')
}
