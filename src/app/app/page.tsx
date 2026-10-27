import {serverClient} from '@/lib/server';
import {redirect} from 'next/navigation';
import {Workspace} from '@/components/workspace';
export const dynamic='force-dynamic';
export default async function Page(){
 if(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY){
 const client=await serverClient();const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login');
 }
 return <Workspace/>;
}
