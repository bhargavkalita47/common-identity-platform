import {NextRequest,NextResponse} from 'next/server';
import type {EmailOtpType} from '@supabase/supabase-js';
import {serverClient,safeNext} from '@/lib/server';
import {emailLanding} from '@/lib/email-session';
export async function GET(request:NextRequest) {
 const url=new URL(request.url),token_hash=url.searchParams.get('token_hash'),type=url.searchParams.get('type');
 const next=type==='recovery'?'/reset-password':safeNext(url.searchParams.get('next'));
 const client=await serverClient();
 if(token_hash && ['signup','recovery','magiclink','invite','email'].includes(type??'')){
  const {error}=await client.auth.verifyOtp({token_hash,type:type as EmailOtpType});
  if(!error)return NextResponse.redirect(new URL(emailLanding(next,type),url.origin));
 }else if(url.searchParams.get('code')){
  const {error}=await client.auth.exchangeCodeForSession(url.searchParams.get('code')!);
  if(!error)return NextResponse.redirect(new URL(emailLanding(next,type),url.origin));
  const login=new URL('/login',url.origin);login.searchParams.set('next',next);
  login.searchParams.set('error','Your email link could not establish a session in this browser. Sign in to continue to your invitation.');
  return NextResponse.redirect(login);
 }else{
  // Default implicit email links carry tokens in the fragment, which the server
  // cannot read. Redirect to a browser handler; browsers retain the fragment.
  const finish=new URL('/auth/finish',url.origin);finish.searchParams.set('next',next);
  return NextResponse.redirect(finish);
 }
 const login=new URL('/login',url.origin);login.searchParams.set('next',next);
 login.searchParams.set('error','The email link is invalid or expired. Sign in or request a new link.');
 return NextResponse.redirect(login);
}
