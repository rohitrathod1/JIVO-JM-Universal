import { allows, ADMIN_ACCESS, type Capability } from '../config/capabilities'
import { APPROVALS_ACCESS } from '../modules/approvals/model'

/** Reference Tailwind `md` breakpoint: the icon rail replaces the phone top/bottom bars from here. */
export const WIDE_BREAKPOINT = 768

export const isWide = (width: number) => width >= WIDE_BREAKPOINT

/**
 * Reference `<main>` padding for ordinary pages (Shell.tsx): `px-4 pt-5` on phones (the 16px gutter) and
 * `md:px-8 md:pt-8 md:pb-10` from 768px. The phone bottom bar is in the layout flow here (not fixed), so the
 * phone bottom padding does not need the reference's extra `pb-28`.
 */
export function pagePadding(width: number) {
  return isWide(width)
    ? { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 40 }
    : { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 }
}

/** WCAG 2.5.5 / Apple HIG minimum touch target on phones (DEF-005). */
export const MIN_TOUCH = 44
/**
 * Transparent hit box for a control drawn at `size` px: on phones (below the `md` breakpoint) it grows to 44px
 * and a negative margin gives the extra back to the layout, so the drawn control stays the same size and place.
 * Put the visual (background, border, radius) on a child of this box, not on the box itself.
 */
export function touchBox(size: number, width: number) {
  const pad = isWide(width) ? 0 : Math.max(0, (MIN_TOUCH - size) / 2)
  return { width: size + pad * 2, height: size + pad * 2, margin: pad ? -pad : 0, alignItems: 'center', justifyContent: 'center' } as const
}

/** Reference control height is 40px (`h-10`); native keeps the 44pt platform touch target. */
export const controlHeight = (platform: string) => (platform === 'web' ? 40 : 44)

/**
 * Reference MessengerPage chats column: `md:w-[360px] lg:w-[400px]`, shown beside the conversation pane
 * from the `md` breakpoint (768px) up; phones show one or the other.
 */
export const chatListWidth = (width: number) => (width >= 1024 ? 400 : 360)

export type ShellIcon = 'home' | 'messagesSquare' | 'key' | 'clipboardCheck' | 'bell' | 'user' | 'shield' | 'shieldCheck' | 'users' | 'lockKeyhole' | 'megaphone' | 'tools'
/** `query` marks a link to one view of a page (e.g. an Admin tab), so it is active only on that view. */
export type ShellLink = { title: string; tabTitle: string; href: string; icon: ShellIcon; query?: { key: string; value: string; fallback?: boolean } }

/** Phone tabs keep five slots, replacing Alerts or Passwords with Tools according to vault access.
 * `tools` identifies the rail link followed by its theme switch.
 */
export function shellLinks(capabilities: readonly string[], preview = false): { rail: ShellLink[]; tabs: ShellLink[]; account: ShellLink[]; tools: string | null } {
  const can = (rule: Capability | readonly Capability[]) => preview || allows(capabilities, rule)
  const keep = (items: (ShellLink | false)[]) => items.filter((item): item is ShellLink => !!item)
  const home: ShellLink = { title: 'Home', tabTitle: 'Home', href: '/home', icon: 'home' }
  const chats = can('JM_ACCESS') && { title: 'Messenger', tabTitle: 'Chats', href: '/messenger', icon: 'messagesSquare' } as ShellLink
  // Notifications are available through the header bell and desktop rail.
  const inbox = can('JM_ACCESS') && { title: 'Notifications', tabTitle: 'Inbox', href: '/notifications', icon: 'bell' } as ShellLink
  const vault = can('JP_ACCESS') && { title: 'Passwords', tabTitle: 'Passwords', href: '/passwords', icon: 'key' } as ShellLink
  const alerts: ShellLink = { title: 'Alerts', tabTitle: 'Alerts', href: '/alerts', icon: 'megaphone' }
  // Reference registry: Approvals follows Passwords (ADMIN_USERS or JP_ACCESS, FE-023).
  const approvals = can(APPROVALS_ACCESS) && { title: 'Approvals', tabTitle: 'Approvals', href: '/approvals', icon: 'clipboardCheck' } as ShellLink
  const people = can('ADMIN_USERS') && { title: 'People', tabTitle: 'People', href: '/admin?tab=people', icon: 'users', query: { key: 'tab', value: 'people', fallback: true } } as ShellLink
  const groups = can(ADMIN_ACCESS) && { title: 'Permission groups', tabTitle: 'Groups', href: '/admin?tab=groups', icon: 'shieldCheck', query: { key: 'tab', value: 'groups', fallback: !can('ADMIN_USERS') } } as ShellLink
  const security = can('ADMIN_USERS') && { title: 'Security', tabTitle: 'Security', href: '/admin?tab=security', icon: 'lockKeyhole', query: { key: 'tab', value: 'security' } } as ShellLink
  const launcher = can('JM_ACCESS') && { title: 'Tools', tabTitle: 'Tools', href: '/tools', icon: 'tools' } as ShellLink
  const manageTools = can('ADMIN_USERS') && { title: 'Software tools', tabTitle: 'Software tools', href: '/admin?tab=tools', icon: 'tools', query: { key: 'tab', value: 'tools' } } as ShellLink
  const profile: ShellLink = { title: 'Profile', tabTitle: 'Profile', href: '/profile', icon: 'user' }
  const admin = can(ADMIN_ACCESS) && { title: 'Administration', tabTitle: 'Admin', href: '/admin', icon: 'shield' } as ShellLink
  const rail = keep([home, chats, inbox, vault, launcher, approvals, people, groups, security, manageTools])
  return {
    rail,
    tabs: keep([home, vault ? launcher : can('JM_ACCESS') && alerts, chats, vault || launcher, profile]),
    // Reference: on phones the remaining pages (and Sign out) are reached from Profile.
    account: keep([profile, can('JM_ACCESS') && alerts, launcher, approvals, admin]),
    tools: chats ? '/notifications' : rail.at(-1)?.href ?? null,
  }
}

export const isActiveLink = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/')

/** Active state for a shell link, including links to one view of a page (`/admin?tab=groups`). */
export function isActiveShellLink(pathname: string, params: Record<string, string | string[] | undefined>, link: ShellLink) {
  const path = link.href.split('?')[0]
  if (!isActiveLink(pathname, path)) return false
  const param = (key: string) => { const value = params[key]; return typeof value === 'string' ? value : undefined }
  if (link.query) { const current = param(link.query.key); return current === link.query.value || (!current && !!link.query.fallback) }
  // A plain link is not lit while one of its views has its own link (the Alerts tab on /notifications).
  return !(path === '/notifications' && param('view') === 'alerts')
}

