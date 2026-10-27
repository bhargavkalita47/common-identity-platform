import {NextRequest,NextResponse} from 'next/server';
import type {EmailOtpType} from '@supabase/supabase-js';
import {serverClient,safeNext} from '@/lib/server';
export async function GET(request:NextRequest) {
 const url=new URL(request.url),token_hash=url.searchParams.get('token_hash'),type=url.searchParams.get('type');
 if(token_hash && ['signup','recovery','magiclink','invite','email'].includes(type??'')){
 const client=await serverClient();const {error}=await client.auth.verifyOtp({token_hash,type:type as EmailOtpType});
 if(!error)return NextResponse.redirect(new URL(type==='recovery'?'/reset-password':safeNext(url.searchParams.get('next')),url.origin));}
 return NextResponse.redirect(new URL('/login?error=The+link+is+invalid+or+expired.',url.origin));
}
