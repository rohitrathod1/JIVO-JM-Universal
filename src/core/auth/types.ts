import type { Capability } from '@/config/capabilities'

import type { SecurityStatus } from './security'

export interface Membership {
  id: string
  company: string
  company_name: string
  company_color: string
  title: string
  department: string
  is_default: boolean
  is_active: boolean
}

/** GET /api/jm/me/ */
export interface Me {
  id: string
  email: string
  full_name: string
  display_name: string
  name: string
  phone: string
  /** "About", at most 300 characters. */
  bio: string
  avatar_url: string | null
  /** Group creation: the capability and the administrator's chat-access policy. */
  can_create_groups: boolean
  /** Superuser: holds every capability (set only on the server, never in JM). */
  is_superuser?: boolean
  /** A requested new email, waiting for an administrator to confirm it. */
  pending_email: string | null
  pending_email_requested_at: string | null
  employee_code: string | null
  date_joined: string
  last_seen_privacy: 'everyone' | 'contacts' | 'nobody'
  companies: Membership[]
  capabilities: Capability[]
  groups: string[]
  session: { id: string; expires_at: string; auth_method: string } | null
  security: SecurityStatus
}
