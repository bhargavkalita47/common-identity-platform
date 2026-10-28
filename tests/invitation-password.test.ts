import {describe,it,expect,vi,beforeEach} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/lib/server',()=>({serverClient:vi.fn()}));
import {serverClient} from '@/lib/server';
import {POST} from '../src/app/api/[...path]/route';
const token='a'.repeat(64),password='test-only-password-123';
const updateUser=vi.fn().mockResolvedValue({data:{},error:null});
function client(identityEmail='invited@example.com',identityError=false){
 return {auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:'invited-id',email:'invited@example.com'}},error:null}),updateUser},
 rpc:vi.fn(async(name:string)=>name==='active_account'?{data:'invited-id',error:null}:identityError?{data:null,error:{code:'42501',message:'Invitation email mismatch'}}:{data:{email:identityEmail},error:null})};
}
function request(){return new NextRequest('https://common.example/api/invitation/password',{method:'POST',headers:{Origin:'https://common.example','Content-Type':'application/json'},body:JSON.stringify({token,password})});}
describe('Invitation password changes enforce account identity',()=>{
 beforeEach(()=>{vi.clearAllMocks();process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='test-public';});
 it('does not update any password if database identity verification denies access',async()=>{
 vi.mocked(serverClient).mockResolvedValue(client('',true) as unknown as Awaited<ReturnType<typeof serverClient>>);
 const response=await POST(request(),{params:Promise.resolve({path:['invitation','password']})});expect(response.status).toBe(403);expect(updateUser).not.toHaveBeenCalled();
 });
 it('rejects mismatched account email even if an RPC result is returned',async()=>{
 vi.mocked(serverClient).mockResolvedValue(client('owner@example.com') as unknown as Awaited<ReturnType<typeof serverClient>>);
 const response=await POST(request(),{params:Promise.resolve({path:['invitation','password']})});expect(response.status).toBe(403);expect(updateUser).not.toHaveBeenCalled();
 });
 it('updates the verified invited account using the request-scoped Supabase client',async()=>{
 vi.mocked(serverClient).mockResolvedValue(client() as unknown as Awaited<ReturnType<typeof serverClient>>);
 const response=await POST(request(),{params:Promise.resolve({path:['invitation','password']})});expect(response.status).toBe(200);expect(updateUser).toHaveBeenCalledExactlyOnceWith({password});
 });
});
