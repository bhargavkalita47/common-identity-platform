import {describe,it,expect,vi} from 'vitest';
import {completeEmailSession,emailDestination,emailLanding} from '../src/lib/email-session';
const invitation='/invite/'+'a'.repeat(64);
function auth(user:unknown={id:'invited-user'}){return {setSession:vi.fn().mockResolvedValue({error:null}),exchangeCodeForSession:vi.fn().mockResolvedValue({error:null}),getUser:vi.fn().mockResolvedValue({data:{user},error:null})};}
describe('Invited account onboarding',()=>{
 it('establishes implicit email session and sends new invitee to password setup',async()=>{const a=auth();const target=await completeEmailSession(a,new URLSearchParams({next:invitation}),new URLSearchParams({access_token:'test-access',refresh_token:'test-refresh',type:'signup'}));expect(a.setSession).toHaveBeenCalledWith({access_token:'test-access',refresh_token:'test-refresh'});expect(target).toBe('/auth/set-password?next='+encodeURIComponent(invitation));});
 it('exchanges recipient-requested PKCE links before checking the user',async()=>{const a=auth();await completeEmailSession(a,new URLSearchParams({next:invitation,code:'test-code'}),new URLSearchParams());expect(a.exchangeCodeForSession).toHaveBeenCalledWith('test-code');expect(a.getUser).toHaveBeenCalledOnce();});
 it('offers link recovery rather than signup or password login when there is no session',async()=>{await expect(completeEmailSession(auth(null),new URLSearchParams({next:invitation}),new URLSearchParams())).rejects.toThrow('You do not need to register again');});
 it('does not consume expired links as successful sessions',async()=>{const a=auth();await expect(completeEmailSession(a,new URLSearchParams(),new URLSearchParams({error:'access_denied'}))).rejects.toThrow('expired or was already used');expect(a.setSession).not.toHaveBeenCalled();});
 it('keeps recovery separate and rejects external redirect destinations',()=>{expect(emailLanding(invitation,'recovery')).toBe('/reset-password');for(const value of ['https://evil.example','//evil.example','/\\evil.example','/\t/evil.example'])expect(emailDestination(value)).toBe('/app');});
});
