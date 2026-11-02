import { expect, it } from 'vitest'
import type { JmAlert } from './api'
import { visibleAlerts } from './live'
it('drops expired/dismissed alerts and prioritizes critical live announcements', () => {
 const alert = { id: 'info', status: 'active', dismissed_at: null, expires_at: null, severity: 'info', created_at: '2026-11-02' } as JmAlert
 expect(visibleAlerts([alert, { ...alert, id: 'critical', severity: 'critical' }, { ...alert, id: 'expired', expires_at: '2020-01-01' }, { ...alert, id: 'dismissed', dismissed_at: '2026-11-02' }, { ...alert, id: 'cancelled', status: 'cancelled' }], Date.parse('2026-11-02')).map(item => item.id)).toEqual(['critical', 'info'])
})
