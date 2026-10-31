import { expect, it } from 'vitest'
import { arrivalBehavior } from './reader'
import { confirmedAccessLoss } from './access'
it('follows only readers near the live end and signals arrivals to readers of history', () => {
 expect(arrivalBehavior(true, false, 10, 11)).toBe('follow'); expect(arrivalBehavior(false, false, 10, 11)).toBe('indicate'); expect(arrivalBehavior(true, true, 10, 11)).toBe('indicate'); expect(arrivalBehavior(true, false, 10, 10)).toBe('none')
})
it('does not confuse a security challenge or server error with access revocation', () => {
 for (const code of ['step_up_required', 'csrf_failed']) expect(confirmedAccessLoss({ response: { status: 403, data: { code } } })).toBe(false)
 for (const status of [403, 404, 410]) expect(confirmedAccessLoss({ response: { status } })).toBe(true)
 expect(confirmedAccessLoss(new Error('offline'))).toBe(false)
})
