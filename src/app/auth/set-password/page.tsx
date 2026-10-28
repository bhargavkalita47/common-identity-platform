'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {browserClient} from '@/lib/supabase';
import {emailDestination} from '@/lib/email-session';
export default function SetInvitationPassword(){
 const [next,setNext]=useState('/app'),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const destination=emailDestination(new URLSearchParams(window.location.search).get('next'));setNext(destination);
  void browserClient().auth.getUser().then(({data,error})=>{
   if(error||!data.user){window.location.replace('/auth/finish?next='+encodeURIComponent(destination));return;}setReady(true);
  });
 },[]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const form=new FormData(e.currentTarget),password=String(form.get('password'));
  if(password!==form.get('confirm')){setError('The passwords do not match.');return;}
  setBusy(true);setError('');
  try{const {error}=await browserClient().auth.updateUser({password});if(error)throw error;window.location.replace(next);}
  catch(e){setError(e instanceof Error?e.message:'Unable to set your password.');}finally{setBusy(false);}
 }
 return <main className="invite-page"><Link className="brand" href="/">common.</Link><section className="invite-card"><span className="eyebrow">EMAIL VERIFIED</span><h1>Finish your account.</h1><p>Your invitation already created your account. Set a password for future sign-ins, then accept your organization invitation. No second email confirmation is needed.</p>{ready?<form onSubmit={submit}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>{error&&<div className="notice error" role="alert">{error}</div>}<button className="button dark wide" disabled={busy}>{busy?'Saving…':'Set password & continue'}</button><a className="text-link" href={next}>Already have a password? Continue to invitation →</a></form>:<p>Checking your verified session…</p>}</section></main>;
}
