'use client';
import Link from 'next/link';
import {useState,type FormEvent} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {ArrowUpRight,ShieldCheck} from 'lucide-react';
import {browserClient,configured} from '@/lib/supabase';
const titles:Record<string,[string,string]>={login:['Welcome back.','Your people, organizations and permissions. Right where you left them.'],register:['A good place to start.','One account. A clear boundary for every organization.'],'forgot-password':['Find your way back.','We will send a secure recovery link to your email.'],'reset-password':['A fresh start.','Set a new password for your account.'],'verify-email':['Check your inbox.','Confirm your email to finish creating your account.']};
export function AuthForm({mode}:{mode:string}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const router=useRouter(),search=useSearchParams();
 const [title,subtitle]=titles[mode];
 async function submit(e:FormEvent<HTMLFormElement>){
 e.preventDefault();setBusy(true);setError('');setMessage('');
 try{
 if(!configured())throw new Error('Connect your Supabase project first. See SETUP.md in the source package.');
 const data=new FormData(e.currentTarget),email=String(data.get('email')??''),password=String(data.get('password')??'');
 const client=browserClient(),origin=window.location.origin;
 const rawNext=search.get('next');const next=rawNext?.startsWith('/')&&!rawNext.startsWith('//')&&!rawNext.includes('\\')?rawNext:'/app';
 if(mode==='login'){
 const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;
 router.push(next);router.refresh();
 }else if(mode==='register'){
 const {data:result,error}=await client.auth.signUp({email,password,options:{data:{display_name:String(data.get('name')??'')},emailRedirectTo:origin+'/auth/confirm?next='+encodeURIComponent(next)}});if(error)throw error;
 if(result.session){router.push(next);router.refresh();}else router.push('/verify-email?email='+encodeURIComponent(email)+'&next='+encodeURIComponent(next));
 }else if(mode==='forgot-password'){
 const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:origin+'/auth/confirm?next=/reset-password'});if(error)throw error;
 setMessage('If this account exists, a recovery link is on its way. Check your inbox and spam folder.');
 }else if(mode==='verify-email'){
 const {error}=await client.auth.resend({type:'signup',email,options:{emailRedirectTo:origin+'/auth/confirm?next='+encodeURIComponent(next)}});if(error)throw error;setMessage('A new verification email is on its way.');
 }else{
 const {error}=await client.auth.updateUser({password});if(error)throw error;
 await client.auth.signOut({scope:'others'});router.push('/app?password=updated');router.refresh();
 }
 }catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}
 }
 return <div className="auth-layout"><aside className="auth-aside"><Link className="brand" href="/"><span className="brandmark">c.</span>common®</Link><div><span className="eyebrow">IDENTITY & ACCESS, IN ORDER.</span><h2>One identity.<br/>A world of<br/><em>clear boundaries.</em></h2><p>Different teams. Different roles.<br/>One secure place to belong.</p></div><div className="auth-aside-foot"><ShieldCheck size={18}/> Built on verified identity.</div></aside><main className="auth-main"><Link className="back-link" href="/">← Back to Common</Link><div className="auth-box"><span className="eyebrow">YOUR COMMON ACCOUNT</span><h1>{title}</h1><p>{subtitle}</p><form onSubmit={submit}>
 {mode==='register'&&<label>Full name<input name="name" autoComplete="name" required maxLength={100} placeholder="Your name"/></label>}
 {mode!=='reset-password'&&<label>Email address<input name="email" type="email" autoComplete="email" defaultValue={search.get('email')??''} required placeholder="you@company.com"/></label>}
 {['login','register','reset-password'].includes(mode)&&<label>Password<input name="password" type="password" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='login'?1:12} maxLength={128} placeholder={mode==='login'?'Enter your password':'At least 12 characters'}/></label>}
 {mode==='login'&&<Link className="forgot-link" href="/forgot-password">Forgot password?</Link>}
 {(error||search.get('error'))&&<div className="notice error" role="alert">{error||search.get('error')}</div>}
 {message&&<div className="notice success" role="status">{message}</div>}
 <button disabled={busy} className="button dark wide">{busy?'Please wait…':mode==='login'?'Sign in':mode==='register'?'Create account':mode==='forgot-password'?'Send recovery link':mode==='verify-email'?'Resend verification email':'Update password'}<ArrowUpRight size={17}/></button>
 </form><p className="auth-switch">{mode==='login'?<>New to Common? <Link href={'/register?next='+encodeURIComponent(search.get('next')??'/app')}>Create an account</Link></>:<>Already have an account? <Link href={'/login?next='+encodeURIComponent(search.get('next')??'/app')}>Sign in</Link></>}</p><div className="auth-fine"><ShieldCheck size={14}/> Your organization access is always checked independently.</div></div></main></div>;
}
