import { describe, expect, it } from 'vitest'
import { approvalConsequence } from './approvalReview'
describe('approval consequence context',()=>{
 it.each(['reset_password','reset_mfa','reactivate','restore'] as const)('explains account restriction for %s',kind=>expect(approvalConsequence({kind,target:{id:'x',name:'Same name',email:'target@example.invalid'}},'approve')).toContain('24 hours'))
 it('distinguishes organisation policy from account recovery',()=>{const message=approvalConsequence({kind:'two_step_off',target:null},'approve');expect(message).toContain('organisation');expect(message).not.toContain('24 hours')})
 it.each(['deny','cancel'] as const)('does not imply execution for %s',choice=>expect(approvalConsequence({kind:'reset_password',target:null},choice)).not.toContain('Create a single-use'))
})
