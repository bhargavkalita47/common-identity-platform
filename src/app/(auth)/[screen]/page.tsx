import {Suspense} from 'react';
import {notFound} from 'next/navigation';
import {AuthForm} from '@/components/auth-form';
export default async function Page({params}:{params:Promise<{screen:string}>}) {
 const {screen}=await params;if(!['login','register','forgot-password','reset-password','verify-email'].includes(screen))notFound();
 return <Suspense fallback={<div className="loading">Loading account…</div>}><AuthForm mode={screen}/></Suspense>;
}
