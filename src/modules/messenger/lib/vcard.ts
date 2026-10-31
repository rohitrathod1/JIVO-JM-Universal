/** Phone contacts shared in a chat travel as a small vCard (.vcf) file through the normal, virus-scanned upload. */

export interface PhoneContact {
  name: string
  phones: string[]
  emails: string[]
}

const escape = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`)
const unescape = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')

export function buildVCard(c: PhoneContact): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escape(c.name.trim())}`, `N:${escape(c.name.trim())};;;;`]
  for (const p of c.phones.map((x) => x.trim()).filter(Boolean)) lines.push(`TEL;TYPE=CELL:${escape(p)}`)
  for (const e of c.emails.map((x) => x.trim()).filter(Boolean)) lines.push(`EMAIL:${escape(e)}`)
  lines.push('END:VCARD')
  return lines.join('\r\n') + '\r\n'
}

/** The first card in the text; unknown lines are ignored. Values are plain text (never HTML). */
export function parseVCard(text: string): PhoneContact {
  // Unfold continuation lines (RFC 6350 §3.2).
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/)
  const out: PhoneContact = { name: '', phones: [], emails: [] }
  let structured = ''
  for (const line of lines) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const key = line.slice(0, i).split(';')[0]!.toUpperCase().replace(/^ITEM\d+\./, '')
    const value = unescape(line.slice(i + 1)).trim()
    if (!value) continue
    if (key === 'FN' && !out.name) out.name = value
    else if (key === 'N' && !structured) structured = value.split(';').filter(Boolean).reverse().join(' ')
    else if (key === 'TEL' && out.phones.length < 5) out.phones.push(value.replace(/^tel:/i, ''))
    else if (key === 'EMAIL' && out.emails.length < 5) out.emails.push(value)
    if (key === 'END') break
  }
  if (!out.name) out.name = structured || out.phones[0] || out.emails[0] || 'Contact'
  return out
}

export function vcardFile(c: PhoneContact): File {
  const safe = c.name.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'Contact'
  return new File([buildVCard(c)], `${safe}.vcf`, { type: 'text/vcard' })
}

export const isVCard = (a: { mime: string; name: string }) => a.mime === 'text/vcard' || /\.vcf$/i.test(a.name)

interface ContactsManager {
  select(props: string[], opts?: { multiple?: boolean }): Promise<{ name?: string[]; tel?: string[]; email?: string[] }[]>
}

/** The phone's own contact picker (Chrome on Android). Desktop browsers do not have one. */
export function phoneContactsSupported(): boolean {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && typeof window !== 'undefined' && 'ContactsManager' in window
}

export async function pickPhoneContacts(): Promise<PhoneContact[]> {
  const manager = (navigator as unknown as { contacts: ContactsManager }).contacts
  const picked = await manager.select(['name', 'tel', 'email'], { multiple: true })
  return picked
    .map((p) => ({ name: p.name?.[0] ?? '', phones: p.tel ?? [], emails: p.email ?? [] }))
    .filter((p) => p.name || p.phones.length || p.emails.length)
    .map((p) => ({ ...p, name: p.name || p.phones[0] || p.emails[0] || 'Contact' }))
}
