import { allows, ADMIN_ACCESS } from '../config/capabilities'

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

/** Reference control height is 40px (`h-10`); native keeps the 44pt platform touch target. */
export const controlHeight = (platform: string) => (platform === 'web' ? 40 : 44)

export type ShellLink = { title: string; tabTitle: string; href: string; icon: 'home' | 'chat' | 'key' | 'bell' | 'user' | 'shield' }

/**
 * Navigation in reference order. Rail: Home, Messenger, then the notification tool right after Messenger,
 * then the remaining pages. Phone bar: Home, inbox, Chats, Passwords, Profile (Admin stays last so it is
 * reachable on phones too). Accessible titles stay stable for scripts; `tabTitle` is the short phone label.
 */
export function shellLinks(capabilities: readonly string[], preview = false): { rail: ShellLink[]; tabs: ShellLink[] } {
  const can = (rule: Parameters<typeof allows>[1]) => preview || allows(capabilities, rule)
  const home: ShellLink = { title: 'Home', tabTitle: 'Home', href: '/home', icon: 'home' }
  const chats: ShellLink | null = can('JM_ACCESS') ? { title: 'Messenger', tabTitle: 'Chats', href: '/messenger', icon: 'chat' } : null
  const activity: ShellLink = { title: 'Activity', tabTitle: 'Activity', href: '/notifications', icon: 'bell' }
  const vault: ShellLink | null = can('JP_ACCESS') ? { title: 'Passwords', tabTitle: 'Passwords', href: '/passwords', icon: 'key' } : null
  const profile: ShellLink = { title: 'Profile', tabTitle: 'Profile', href: '/profile', icon: 'user' }
  const admin: ShellLink | null = can(ADMIN_ACCESS) ? { title: 'Admin', tabTitle: 'Admin', href: '/admin', icon: 'shield' } : null
  const keep = (items: (ShellLink | null)[]) => items.filter((item): item is ShellLink => !!item)
  return { rail: keep([home, chats, activity, vault, profile, admin]), tabs: keep([home, activity, chats, vault, profile, admin]) }
}

export const isActiveLink = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/')
