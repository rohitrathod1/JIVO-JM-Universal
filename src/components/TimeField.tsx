import { useColors } from '../ui'
export interface TimeFieldProps { label: string; value: string; disabled?: boolean; onChange: (value: string) => void }
export function TimeField({ label, value, disabled, onChange }: TimeFieldProps) {
  const c = useColors()
  return <input aria-label={label} type="time" value={value} disabled={disabled} onChange={e => onChange(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 12px', borderRadius: 12, border: `1px solid ${c.border}`, background: c.panel, color: c.text, colorScheme: c.dark ? 'dark' : 'light', fontSize: 16 }} />
}
