import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '@supabase/supabase-js';
import {serverClient} from '@/lib/server';
export const dynamic='force-dynamic';
const uuid=z.string().uuid();
const resource=z.object({title:z.string().trim().min(1).max(160),body:z.string().max(20000).default('')});
const inviteFields='id,organization_id,email,role,status,invited_by,expires_at,created_at';
type Context={params:Promise<{path:string[]}>};
class HttpError extends Error{constructor(public status:number,message:string){super(message);}}
function json(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});}
async function handler(req:NextRequest,ctx:Context) {
 try{
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) throw new HttpError(503,'Supabase is not configured. Follow SETUP.md.');
 if(!['GET','HEAD'].includes(req.method) && req.headers.get('origin')!==new URL(req.url).origin) throw new HttpError(403,'Same-origin request required');
 const client=await serverClient();
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError || !user) throw new HttpError(401,'Sign in to continue');
 const active=await client.rpc('active_account');
 if(active.error || active.data!==user.id) throw new HttpError(401,'Session expired or revoked. Sign in again.');
 const {path}=await ctx.params, [area,org,section,id]=path;
 const method=req.method;
 const body=method==='GET'?{}:await req.json().catch(()=>{throw new HttpError(400,'JSON body required');});
 function unwrap<T>(result:{data:T;error:{message:string;code?:string}|null}):T {
 if(result.error) throw new HttpError(result.error.code==='42501'?403:result.error.code==='23505'||result.error.code==='23514'?409:400,result.error.message);return result.data;
 }
 if(area==='me' && method==='GET'){
 const memberships=unwrap(await client.from('organization_members').select('role,organization_id,organizations(id,name,description,created_at)').eq('user_id',user.id));
 const profile=unwrap(await client.from('profiles').select('*').eq('id',user.id).single());
 return json({user:{id:user.id,email:user.email,...profile},memberships});
 }
 if(area==='profile' && method==='PATCH') {
 const data=z.object({display_name:z.string().trim().max(100)}).parse(body);
 return json(unwrap(await client.from('profiles').update(data).eq('id',user.id).select().single()));
 }
 if(area==='sessions') {
 if(method==='GET')return json(unwrap(await client.rpc('account_sessions')));
 if(method==='DELETE'){uuid.parse(org);unwrap(await client.rpc('revoke_session',{p_session:org}));return json({ok:true});}
 }
 if(area==='invitation' && method==='POST'){
 const data=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),decision:z.enum(['accept','decline'])}).parse(body);
 return json({organization_id:unwrap(await client.rpc('respond_invitation',{p_token:data.token,p_decision:data.decision}))});
 }
 if(area==='organizations' && !org && method==='POST'){
 const data=z.object({name:z.string().trim().min(2).max(80),description:z.string().max(300).default('')}).parse(body);
 return json({id:unwrap(await client.rpc('create_organization',{p_name:data.name,p_description:data.description}))},201);
 }
 if(area!=='organizations' || !org)throw new HttpError(404,'Endpoint unavailable');
 uuid.parse(org);
 const membership=unwrap(await client.from('organization_members').select('role').eq('organization_id',org).eq('user_id',user.id).maybeSingle());
 if(!membership)throw new HttpError(403,'You do not have access to this organization');
 if(!section && method==='PATCH'){
 const data=z.object({name:z.string().trim().min(2).max(80),description:z.string().max(300).default('')}).parse(body);
 return json(unwrap(await client.rpc('organization_command',{p_org:org,p_action:'rename',p_data:data})));
 }
 if(section==='members'){
 if(method==='GET')return json(unwrap(await client.from('organization_members').select('user_id,role,joined_at,profiles:user_id(id,display_name,email)').eq('organization_id',org).order('joined_at')));
 if(method==='PATCH'||method==='DELETE'){
 uuid.parse(id);const data=method==='PATCH'?z.object({role:z.enum(['owner','admin','member','viewer'])}).parse(body):{};
 return json(unwrap(await client.rpc('organization_command',{p_org:org,p_action:method==='DELETE'?'remove':'role',p_data:{...data,user_id:id}})));
 }}
 if(section==='invitations'){
 if(method==='GET') {
 if(!['owner','admin'].includes(membership.role))throw new HttpError(403,'Administrator access required');
 return json(unwrap(await client.from('invitations').select(inviteFields).eq('organization_id',org).order('created_at',{ascending:false})));
 }
 if(method==='POST'){
 const data=z.object({email:z.email().max(254),role:z.enum(['admin','member','viewer'])}).parse(body);
 const invitation=unwrap(await client.rpc('organization_command',{p_org:org,p_action:'invite',p_data:data})) as {id:string;token:string};
 // Supabase's established email infrastructure delivers a sign-in link to the invitee.
 const origin=process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
 const redirect=new URL('/auth/finish',origin);redirect.searchParams.set('next','/invite/'+invitation.token);
 const mail=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await mail.auth.signInWithOtp({email:data.email,options:{emailRedirectTo:redirect.toString(),shouldCreateUser:true}});
 return json({id:invitation.id,invite_url:new URL('/invite/'+invitation.token,origin).toString(),email_sent:!error,warning:error?'Invitation created. Email delivery failed; copy the invitation link. Check SMTP configuration and Auth email limits.':null},201);
 }
 if(method==='DELETE'){uuid.parse(id);return json(unwrap(await client.rpc('organization_command',{p_org:org,p_action:'revoke',p_data:{id}})));}
 }
 if(section==='resources'){
 if(id)uuid.parse(id);
 if(method==='GET'){let query=client.from('resources').select('*').eq('organization_id',org).order('updated_at',{ascending:false});if(id)query=query.eq('id',id);return json(unwrap(await query));}
 if(method==='POST')return json(unwrap(await client.from('resources').insert({...resource.parse(body),organization_id:org,created_by:user.id}).select().single()),201);
 if(method==='PATCH'&&id){const data=unwrap(await client.from('resources').update(resource.parse(body)).eq('organization_id',org).eq('id',id).select().maybeSingle());if(!data)throw new HttpError(403,'Resource unavailable or update not permitted');return json(data);}
 if(method==='DELETE'&&id){const data=unwrap(await client.from('resources').delete().eq('organization_id',org).eq('id',id).select('id').maybeSingle());if(!data)throw new HttpError(403,'Resource unavailable or deletion not permitted');return json(data);}
 }
 if(section==='audit'&&method==='GET'){
 if(!['owner','admin'].includes(membership.role))throw new HttpError(403,'Administrator access required');
 return json(unwrap(await client.from('audit_events').select('*').eq('organization_id',org).order('created_at',{ascending:false}).limit(100)));
 }
 if(section==='access-test'&&method==='POST'){
 // A deliberately forbidden real database write: no role has audit INSERT privilege.
 const result=await client.from('audit_events').insert({organization_id:org,actor_id:user.id,action:'probe.attempt'});
 if(result.error)return json({allowed:false,layer:'PostgreSQL',code:result.error.code,message:result.error.message},403);
 return json({allowed:true,layer:'PostgreSQL'},201);
 }
 throw new HttpError(404,'Endpoint unavailable');
 }catch(e){
 if(e instanceof z.ZodError)return json({error:e.issues.map(x=>x.message).join('; ')},400);
 if(e instanceof HttpError)return json({error:e.message},e.status);
 console.error('API operation failed',e instanceof Error?e.message:'unknown');
 return json({error:'Request failed. Please retry.'},500);
 }
}
export const GET=handler,POST=handler,PATCH=handler,DELETE=handler;
