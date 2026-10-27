// Explicit sample identities for a NEW demo project. Never run against production data.
import {createClient} from '@supabase/supabase-js';
const {NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:secret,DEMO_PASSWORD:password}=process.env;
if(!url||!key||!secret||!password||password.length<12)throw new Error('Set Supabase keys and a unique DEMO_PASSWORD of at least 12 characters in .env.local.');
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const clients={},users={};
for(const name of ['owner','admin','member','viewer','atlas']){
 const email=name+'@common-demo.example';
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:{owner:'Alex Morgan',admin:'Sam Rivera',member:'Jordan Lee',viewer:'Casey Chen',atlas:'Robin Patel'}[name]}});
 if(error)throw new Error('Seed stopped: '+error.message+'. This script is intentionally not destructive or rerunnable.');
 users[name]=data.user.id;clients[name]=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await clients[name].auth.signInWithPassword({email,password});if(login.error)throw login.error;
}
const north=await clients.owner.rpc('create_organization',{p_name:'Northstar Studio',p_description:'A sample product and design organization.'});if(north.error)throw north.error;
const atlas=await clients.atlas.rpc('create_organization',{p_name:'Atlas Research',p_description:'An independent organization for tenant isolation demonstrations.'});if(atlas.error)throw atlas.error;
for(const role of ['admin','member','viewer']){
 const inv=await clients.owner.rpc('organization_command',{p_org:north.data,p_action:'invite',p_data:{email:role+'@common-demo.example',role}});if(inv.error)throw inv.error;
 const accept=await clients[role].rpc('respond_invitation',{p_token:inv.data.token,p_decision:'accept'});if(accept.error)throw accept.error;
}
for(const [name,organization_id,titles] of [['owner',north.data,['Internal onboarding guide','Security review notes','Team handbook']],['atlas',atlas.data,['Research protocol','Private study notes']]]){
 for(const title of titles){const r=await clients[name].from('resources').insert({organization_id,created_by:users[name],title,body:'This is an organization-owned sample resource. Members can edit it. Viewers can read it. People outside the organization cannot retrieve it.'});if(r.error)throw r.error;}
}
console.log('Sample data created. Northstar:',north.data,'Atlas:',atlas.data);
console.log('Accounts: owner, admin, member, viewer, atlas @common-demo.example. Password: your configured DEMO_PASSWORD (not printed).');
