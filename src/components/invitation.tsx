'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Mail,ArrowUpRight} from 'lucide-react';
export function Invitation({token}:{token:string}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);const router=useRouter();
 async function respond(decision:string){setBusy(true);setMessage('');try{
 const r=await fetch('/api/invitation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,decision})});const data=await r.json();
 if(r.status===401){router.push('/login?next='+encodeURIComponent('/invite/'+token));return;}
 if(!r.ok)throw new Error(data.error);
 if(decision==='accept'){localStorage.setItem('common.organization',data.organization_id);router.push('/app');router.refresh();}else setMessage('Invitation declined. You can safely close this page.');
 }catch(e){setMessage(e instanceof Error?e.message:'Unable to respond');}finally{setBusy(false);}}
 return <main className="invite-page"><Link href="/" className="brand">common.</Link><div className="invite-card"><div className="big-icon"><Mail/></div><span className="eyebrow">YOU HAVE BEEN INVITED</span><h1>A place on the team.</h1><p>Sign in using the email address that received this invitation. Your membership and role will be confirmed securely.</p>{message&&<div className="notice" role="status">{message}</div>}<button className="button dark wide" disabled={busy} onClick={()=>respond('accept')}>Accept invitation <ArrowUpRight size={17}/></button><button className="button wide" disabled={busy} onClick={()=>respond('decline')}>Decline invitation</button><Link className="text-link" href={'/login?next='+encodeURIComponent('/invite/'+token)}>Sign in with a different account →</Link><small>Invitations expire after 7 days and can only be used once.</small></div></main>;
}
