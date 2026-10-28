'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {createBrowserClient} from '@supabase/ssr';
import {completeEmailSession,emailDestination} from '@/lib/email-session';
function callbackClient(){return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{isSingleton:false,auth:{detectSessionInUrl:false,autoRefreshToken:false}});}
export default function FinishAuthentication(){
 const started=useRef(false);
 const [error,setError]=useState(''),[next,setNext]=useState('/app'),[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
 useEffect(()=>{
  if(started.current)return;started.current=true;
  const url=new URL(window.location.href),fragment=new URLSearchParams(url.hash.slice(1));
  setNext(emailDestination(url.searchParams.get('next')));
  window.history.replaceState(null,'',url.pathname+url.search);
  async function finish(){
   if(url.searchParams.get('token_hash')){window.location.replace('/auth/confirm'+url.search);return;}
   const destination=await completeEmailSession(callbackClient().auth,url.searchParams,fragment);
   window.location.replace(destination);
  }
  void finish().catch(e=>setError(e instanceof Error?e.message:'Unable to complete sign-in. Request a fresh link below.'));
 },[]);
 async function resend(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setSent(false);
  try{
   const email=String(new FormData(e.currentTarget).get('email')).trim();
   const redirect=new URL('/auth/finish',window.location.origin);redirect.searchParams.set('next',next);
   // Requested by the recipient, so its PKCE verifier is stored in THEIR browser.
   const {error}=await callbackClient().auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:redirect.toString()}});
   if(error)throw error;setSent(true);
  }catch(e){setError(e instanceof Error?e.message:'Unable to send a link.');}finally{setBusy(false);}
 }
 return <main className="invite-page"><Link className="brand" href="/">common.</Link><section className="invite-card"><h1>{error?'Continue to your invitation':'Completing sign-in…'}</h1><p>{error||'Verifying your email and preparing your account.'}</p>{error&&<><form onSubmit={resend}><label>Invited email address<input name="email" type="email" required autoComplete="email" placeholder="The address that received the invitation"/></label><button className="button dark wide" disabled={busy}>{busy?'Sending…':'Email me a new sign-in link'}</button></form>{sent&&<div className="notice success" role="status">Check your inbox. Open the newest link in this browser. It will return you to this invitation without another registration.</div>}<Link prefetch={false} className="text-link" href={'/login?next='+encodeURIComponent(next)}>Already set a password? Sign in</Link></>}</section></main>;
}
