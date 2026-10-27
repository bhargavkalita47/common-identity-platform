import {NextRequest,NextResponse} from 'next/server';
import {serverClient,safeNext} from '@/lib/server';
export async function GET(request:NextRequest) {
 const url=new URL(request.url),code=url.searchParams.get('code');
 if(code){const client=await serverClient();const {error}=await client.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(safeNext(url.searchParams.get('next')),url.origin));}
 return NextResponse.redirect(new URL('/login?error=The+link+has+expired.+Please+request+a+new+one.',url.origin));
}
