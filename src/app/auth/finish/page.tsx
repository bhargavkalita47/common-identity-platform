'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {createBrowserClient} from '@supabase/ssr';
export default function FinishAuthentication(){
 const started=useRef(false);
 const [error,setError]=useState(''),[next,setNext]=useState('/app');
 useEffect(()=>{
  if(started.current)return;started.current=true;
  const url=new URL(window.location.href);
  const value=url.searchParams.get('next');
  const destination=value?.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')?value:'/app';
  setNext(destination);
  const fragment=new URLSearchParams(url.hash.slice(1));
  // Remove bearer credentials before any navigation or rendering of errors.
  window.history.replaceState(null,'',url.pathname+url.search);
  async function finish(){
   if(fragment.get('error')||url.searchParams.get('error'))throw new Error('This email link has expired or could not be verified. Request a new invitation or sign in below.');
   if(url.searchParams.get('token_hash')||url.searchParams.get('code')){
    window.location.replace('/auth/confirm'+url.search);return;
   }
   const client=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{detectSessionInUrl:false}});
   const access_token=fragment.get('access_token'),refresh_token=fragment.get('refresh_token');
   if(access_token&&refresh_token){
    const result=await client.auth.setSession({access_token,refresh_token});if(result.error)throw result.error;
   }
   const verified=await client.auth.getUser();
   if(verified.error||!verified.data.user)throw new Error('No session was found. Sign in below to continue to your invitation.');
   window.location.replace(fragment.get('type')==='recovery'?'/reset-password':destination);
  }
  void finish().catch(()=>setError('We could not complete sign-in from this email link. Use the same browser that requested it, request a fresh link, or sign in below to continue.'));
 },[]);
 return <main className="invite-page"><Link className="brand" href="/">common.</Link><section className="invite-card"><h1>{error?'Continue to your invitation':'Completing sign-in…'}</h1><p>{error||'Verifying your email and opening your workspace.'}</p>{error&&<><Link className="button dark wide" href={'/login?next='+encodeURIComponent(next)}>Sign in to continue</Link><Link className="text-link" href={'/register?next='+encodeURIComponent(next)}>Create an account with the invited email</Link></>}</section></main>;
}
