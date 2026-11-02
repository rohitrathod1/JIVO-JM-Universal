/** With Jivo Auth (BE-082): a JIVO account granted JM access, and the JM account it already has (null: not added yet). */
export interface JivoCandidate {
  auth_id: string
  email: string
  full_name: string
  employee_code: string
  is_active: boolean
  local_user_id: string | null
}

/** "New person" lists only active JIVO accounts that are not in JM yet, filtered by name, email or employee code. */
export function addableJivoCandidates(candidates: readonly JivoCandidate[] | null | undefined, search: string): JivoCandidate[] {
  const term = search.trim().toLowerCase()
  return (candidates ?? [])
    .filter(p => !p.local_user_id && p.is_active)
    .filter(p => !term || [p.full_name, p.email, p.employee_code].some(v => (v ?? '').toLowerCase().includes(term)))
}
