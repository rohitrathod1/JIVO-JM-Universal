import { beforeEach,describe,expect,it,vi } from 'vitest'
import { confirmPasskey } from './security.web'
const mock=vi.hoisted(()=>({post:vi.fn(),authenticate:vi.fn(),cancel:vi.fn()}))
vi.mock('../api/client',()=>({api:{post:mock.post}}))
vi.mock('@simplewebauthn/browser',()=>({browserSupportsWebAuthn:()=>true,startAuthentication:mock.authenticate,startRegistration:vi.fn(),WebAuthnAbortService:{cancelCeremony:mock.cancel}}))
beforeEach(()=>{vi.resetAllMocks();mock.post.mockResolvedValue({data:{methods:['passkey','password'],passkey:{flow:'synthetic-flow',options:{challenge:'synthetic'}}}});mock.authenticate.mockResolvedValue({id:'synthetic-credential'})})
describe('web step-up adapter cancellation',()=>{
 it('submits the unchanged server flow and credential contract',async()=>{const signal=new AbortController().signal;await confirmPasskey('jp',signal);expect(mock.post).toHaveBeenLastCalledWith('/auth/step-up/',{scope:'jp',method:'passkey',flow:'synthetic-flow',credential:{id:'synthetic-credential'}},{signal})})
 it('never opens a credential surface after options finish for a cancelled request',async()=>{const abort=new AbortController();mock.post.mockImplementationOnce(async()=>{abort.abort();return{data:{methods:['passkey'],passkey:{flow:'x',options:{}}}}});await expect(confirmPasskey('jp',abort.signal)).rejects.toMatchObject({name:'AbortError'});expect(mock.authenticate).not.toHaveBeenCalled();expect(mock.cancel).toHaveBeenCalledOnce()})
 it('aborts the ceremony and never submits a late credential',async()=>{const abort=new AbortController();mock.authenticate.mockImplementation(async()=>{abort.abort();return{id:'late'}});await expect(confirmPasskey('jp',abort.signal)).rejects.toMatchObject({name:'AbortError'});expect(mock.post).toHaveBeenCalledTimes(1);expect(mock.cancel).toHaveBeenCalledOnce()})
 it('does not invent a passkey when server options omit it',async()=>{mock.post.mockResolvedValueOnce({data:{methods:['password'],passkey:null}});await expect(confirmPasskey('jp')).rejects.toThrow('did not offer');expect(mock.authenticate).not.toHaveBeenCalled()})
})
