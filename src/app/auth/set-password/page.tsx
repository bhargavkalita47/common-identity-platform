'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {emailDestination} from '@/lib/email-session';
export default function SetInvitationPassword(){
 const [next,setNext]=useState('/app'),[token,setToken]=useState(''),[email,setEmail]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const destination=emailDestination(new URLSearchParams(window.location.search).get('next'));setNext(destination);
  const invitationToken=/^\/invite\/([a-f0-9]{64})$/.exec(destination)?.[1];
  if(!invitationToken){setError('Open a valid organization invitation to set up this account.');return;}setToken(invitationToken);
  void fetch('/api/invitation?token='+invitationToken,{cache:'no-store'}).then(async response=>{
   const result=await response.json();if(!response.ok)throw new Error(result.error);
   setEmail(result.email);setReady(true);
  }).catch(e=>setError(e instanceof Error?e.message:'Unable to verify this invitation.'));
 },[]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const form=new FormData(e.currentTarget),password=String(form.get('password'));
  if(password!==form.get('confirm')){setError('The passwords do not match.');return;}
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/invitation/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})});
   const result=await response.json();if(!response.ok)throw new Error(result.error);
   window.location.replace(next);
  }catch(e){setError(e instanceof Error?e.message:'Unable to set your password.');}finally{setBusy(false);}
 }
 return <main className="invite-page"><Link className="brand" href="/">common.</Link><section className="invite-card"><span className="eyebrow">INVITATION ACCOUNT SETUP</span><h1>Finish your account.</h1>{email&&<div className="notice"><strong>Setting the password for: {email}</strong></div>}<p>We check that your verified account matches the invited email before allowing a password change.</p>{error&&<div className="notice error" role="alert">{error}</div>}{ready?<form onSubmit={submit}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><button className="button dark wide" disabled={busy}>{busy?'Saving…':'Set password & continue'}</button><a className="text-link" href={next}>Already have a password? Continue to invitation →</a></form>:error?<Link prefetch={false} className="button dark wide" href={'/auth/finish?next='+encodeURIComponent(next)}>Get a fresh link for the invited email</Link>:<p>Checking the invited account…</p>}</section></main>;
}
