import { allows, type CapabilityRule } from '../config/capabilities'
const tiles: { title: string; description: string; href: string; rule?: CapabilityRule }[] = [
 { title: 'Messenger', description: 'Conversations, files and your team.', href: '/messenger', rule: 'JM_ACCESS' },
 { title: 'Passwords', description: 'Your vaults and shared passwords.', href: '/passwords', rule: 'JP_ACCESS' },
 { title: 'Profile & security', description: 'Your details, sign-in and devices.', href: '/profile' },
 { title: 'People', description: 'Manage people and access.', href: '/admin?tab=people', rule: 'ADMIN_USERS' },
 { title: 'Permission groups', description: 'Review group permissions.', href: '/admin?tab=groups', rule: ['ADMIN_USERS','ADMIN_AUDIT'] },
 { title: 'Security', description: 'Organization security policy.', href: '/admin?tab=security', rule: 'ADMIN_USERS' },
 { title: 'Alerts', description: 'Send team announcements.', href: '/notifications?view=alerts', rule: 'JM_SEND_ALERT' },
 { title: 'Team vaults', description: 'Manage team vault ownership.', href: '/passwords?view=admin', rule: 'JP_MANAGE_VAULT' },
 { title: 'Emergency access', description: 'Request or review emergency access.', href: '/passwords?view=break-glass', rule: ['JP_BREAK_GLASS','JP_REQUEST_EMERGENCY'] },
]
export const homeTiles = (capabilities: readonly string[]) => tiles.filter(tile => allows(capabilities,tile.rule))
