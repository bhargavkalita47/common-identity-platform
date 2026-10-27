// REAL Supabase tests. They are skipped unless an isolated test project is configured.
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {randomUUID,randomBytes} from 'node:crypto';
const enabled=process.env.RUN_SECURITY_TESTS==='true';
describe.skipIf(!enabled)('Live PostgreSQL tenant isolation and authorization',()=>{
 let service:SupabaseClient;let orgA:string,orgB:string,resourceId:string;const accounts:Record<string,{id:string;client:SupabaseClient}>={};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
 const suffix=randomUUID().slice(0,8),password=randomBytes(24).toString('base64url')+'aA1!';
 async function command(actor:string,action:string,data:unknown){return accounts[actor].client.rpc('organization_command',{p_org:orgA,p_action:action,p_data:data});}
 async function invite(email:string){const r=await command('owner','invite',{email,role:'viewer'});expect(r.error).toBeNull();return r.data as {id:string;token:string};}
 beforeAll(async()=>{
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Test project service key is required');
 service=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 for(const name of ['owner','admin','member','viewer','outsider']){
 const email='common-test-'+name+'-'+suffix+'@example.com';
 const created=await service.auth.admin.createUser({email,password,email_confirm:true});if(created.error)throw created.error;
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await client.auth.signInWithPassword({email,password});if(login.error)throw login.error;
 accounts[name]={id:created.data.user!.id,client};
 }
 const a=await accounts.owner.client.rpc('create_organization',{p_name:'Test A '+suffix});if(a.error)throw a.error;orgA=a.data;
 const b=await accounts.outsider.client.rpc('create_organization',{p_name:'Test B '+suffix});if(b.error)throw b.error;orgB=b.data;
 // Fixtures use service credentials; every assertion uses ordinary authenticated clients.
 const membership=await service.from('organization_members').insert(['admin','member','viewer'].map(role=>({organization_id:orgA,user_id:accounts[role].id,role})));if(membership.error)throw membership.error;
 const r=await accounts.owner.client.from('resources').insert({organization_id:orgA,created_by:accounts.owner.id,title:'Private A',body:'Only A'}).select().single();if(r.error)throw r.error;resourceId=r.data.id;
 });
 afterAll(async()=>{
 if(!service)return;
 for(const id of [orgA,orgB].filter(Boolean))await service.from('organizations').delete().eq('id',id);
 for(const a of Object.values(accounts))await service.auth.admin.deleteUser(a.id);
 });
 it('denies unauthenticated data reads',async()=>{const r=await createClient(url,key).from('resources').select('*');expect(r.error).not.toBeNull();});
 it('hides cross-tenant IDs on direct Data API reads',async()=>{const r=await accounts.outsider.client.from('resources').select('*').eq('id',resourceId);expect(r.error).toBeNull();expect(r.data).toEqual([]);});
 it('denies cross-tenant insertion with forged organization ID',async()=>{const r=await accounts.outsider.client.from('resources').insert({organization_id:orgA,created_by:accounts.outsider.id,title:'Forged'});expect(r.error?.code).toBe('42501');});
 it('denies cross-tenant updates and deletes',async()=>{for(const op of ['update','delete']){const q=op==='update'?accounts.outsider.client.from('resources').update({title:'Compromised'}):accounts.outsider.client.from('resources').delete();const r=await q.eq('id',resourceId).select();expect(r.data??[]).toEqual([]);}const r=await accounts.owner.client.from('resources').select('title').eq('id',resourceId).single();expect(r.data?.title).toBe('Private A');});
 it('enforces role-specific editing',async()=>{const allowed=await accounts.member.client.from('resources').update({body:'Member edit'}).eq('id',resourceId).select();expect(allowed.error).toBeNull();expect(allowed.data).toHaveLength(1);const denied=await accounts.viewer.client.from('resources').update({body:'Viewer edit'}).eq('id',resourceId).select();expect(denied.data??[]).toHaveLength(0);});
 it('prevents moving a resource across tenants',async()=>{const r=await accounts.owner.client.from('resources').update({organization_id:orgB}).eq('id',resourceId);expect(r.error?.code).toBe('42501');});
 it('blocks direct membership writes and self-escalation',async()=>{const r=await accounts.member.client.from('organization_members').update({role:'owner'}).eq('user_id',accounts.member.id);expect(r.error?.code).toBe('42501');expect((await command('member','role',{user_id:accounts.member.id,role:'owner'})).error?.code).toBe('42501');});
 it('prevents Admins from granting or changing ownership',async()=>{expect((await command('admin','role',{user_id:accounts.viewer.id,role:'owner'})).error?.code).toBe('42501');expect((await command('admin','role',{user_id:accounts.owner.id,role:'member'})).error?.code).toBe('42501');});
 it('retains the last Owner',async()=>{expect((await command('owner','remove',{user_id:accounts.owner.id})).error?.code).toBe('23514');expect((await command('owner','role',{user_id:accounts.owner.id,role:'member'})).error?.code).toBe('23514');});
 it('rejects invalid, wrong-email, revoked and expired invitations',async()=>{
 expect((await accounts.viewer.client.rpc('respond_invitation',{p_token:'0'.repeat(64),p_decision:'accept'})).error).not.toBeNull();
 const email=(await service.auth.admin.getUserById(accounts.viewer.id)).data.user!.email!;
 const inv=await invite(email);
 expect((await accounts.member.client.rpc('respond_invitation',{p_token:inv.token,p_decision:'accept'})).error?.code).toBe('42501');
 await command('owner','revoke',{id:inv.id});
 expect((await accounts.viewer.client.rpc('respond_invitation',{p_token:inv.token,p_decision:'accept'})).error).not.toBeNull();
 const expired=await invite(email);await service.from('invitations').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',expired.id);
 expect((await accounts.viewer.client.rpc('respond_invitation',{p_token:expired.token,p_decision:'accept'})).error).not.toBeNull();
 await command('owner','revoke',{id:expired.id});
 });
 it('accepts a valid invitation once and does not expose its hash',async()=>{
 const email=(await service.auth.admin.getUserById(accounts.outsider.id)).data.user!.email!;
 const inv=await invite(email);const r=await accounts.outsider.client.rpc('respond_invitation',{p_token:inv.token,p_decision:'accept'});expect(r.error).toBeNull();
 expect((await accounts.outsider.client.rpc('respond_invitation',{p_token:inv.token,p_decision:'accept'})).error).not.toBeNull();
 expect((await accounts.owner.client.from('invitations').select('token_hash')).error?.code).toBe('42501');
 });
 it('serializes simultaneous Owner demotions',async()=>{
 expect((await command('owner','role',{user_id:accounts.admin.id,role:'owner'})).error).toBeNull();
 const attempts=await Promise.all([command('owner','role',{user_id:accounts.owner.id,role:'member'}),command('admin','role',{user_id:accounts.admin.id,role:'member'})]);
 expect(attempts.filter(x=>!x.error)).toHaveLength(1);
 const remaining=await service.from('organization_members').select('user_id').eq('organization_id',orgA).eq('role','owner');expect(remaining.data).toHaveLength(1);
 // Restore deterministic fixture through the service account.
 await service.from('organization_members').update({role:'owner'}).eq('organization_id',orgA).eq('user_id',accounts.owner.id);
 await service.from('organization_members').update({role:'admin'}).eq('organization_id',orgA).eq('user_id',accounts.admin.id);
 });
 it('revokes removed members immediately even with an unexpired JWT',async()=>{
 expect((await command('owner','remove',{user_id:accounts.viewer.id})).error).toBeNull();
 const r=await accounts.viewer.client.from('resources').select('*').eq('organization_id',orgA);expect(r.data).toEqual([]);
 });
 it('keeps audit events append-only for all application roles',async()=>{
 for(const name of ['owner','member']){
 expect((await accounts[name].client.from('audit_events').insert({organization_id:orgA,action:'forged'})).error?.code).toBe('42501');
 expect((await accounts[name].client.from('audit_events').update({action:'forged'}).eq('organization_id',orgA)).error?.code).toBe('42501');
 expect((await accounts[name].client.from('audit_events').delete().eq('organization_id',orgA)).error?.code).toBe('42501');
 }
 expect((await accounts.member.client.from('audit_events').select('*')).data).toEqual([]);
 });
 it('blocks a revoked live session even when its JWT is still valid',async()=>{
 const client=accounts.member.client;const sessions=await client.rpc('account_sessions');const current=sessions.data.find((s:{current:boolean})=>s.current);
 const jwt=(await client.auth.getSession()).data.session!.access_token;
 expect((await client.rpc('revoke_session',{p_session:current.id})).error).toBeNull();
 const stale=createClient(url,key,{global:{headers:{Authorization:'Bearer '+jwt}},auth:{persistSession:false,autoRefreshToken:false}});
 expect((await stale.rpc('active_account')).data).toBeNull();
 expect((await stale.from('resources').select('*').eq('organization_id',orgA)).data).toEqual([]);
 });
});
