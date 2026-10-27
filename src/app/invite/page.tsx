import {Invitation} from '@/components/invitation';
export default async function Page({params}:{params:Promise<{token:string}>}){return <Invitation token={(await params).token}/>;}
