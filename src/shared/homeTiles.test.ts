import { describe, expect, it } from 'vitest'
import { homeTiles } from './homeTiles'
import { mentionToken, withMentionTokens, typingLabel } from '../modules/messenger/lib/text'
describe('home capability tiles and original mention contracts',()=>{
 it('always provides profile and hides unauthorized shortcuts',()=>{expect(homeTiles([]).map(t=>t.title)).toEqual(['Profile & security']);expect(homeTiles(['ADMIN_AUDIT']).map(t=>t.title)).toEqual(['Profile & security','Permission groups'])})
 it('maps emergency and admin shortcuts without granting access',()=>{expect(homeTiles(['JP_REQUEST_EMERGENCY']).some(t=>t.href==='/passwords?view=break-glass')).toBe(true);expect(homeTiles(['ADMIN_USERS']).some(t=>t.href==='/admin?tab=people')).toBe(true)})
 it('tokenizes longest names, escapes regex and excludes self',()=>{const members=[{user:{id:'1',name:'Ann'},is_me:false},{user:{id:'2',name:'Ann Lee'},is_me:false},{user:{id:'3',name:'Me'},is_me:true},{user:{id:'4',name:'A+B'},is_me:false}];expect(withMentionTokens('@Ann Lee @Ann @Annex @Me @A+B',members)).toBe('@[Ann Lee](2) @[Ann](1) @Annex @Me @[A+B](4)')})
 it('strips mention delimiters and uses original typing labels',()=>{expect(mentionToken('A[\n]B','id')).toBe('@[AB](id)');expect(typingLabel(['Ann Lee','Bob Smith'],true)).toBe('Ann and Bob are typing…')})
})
