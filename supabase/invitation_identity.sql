create or replace function private.invitation_identity(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid=private.active_uid(); inv public.invitations; account_email text;
begin
 if uid is null then raise exception 'A verified active session is required' using errcode='42501'; end if;
 select * into inv from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if inv.id is null or inv.status<>'pending' or inv.expires_at<=now() then raise exception 'This invitation is expired or unavailable'; end if;
 select lower(email) into account_email from auth.users where id=uid;
 if account_email<>lower(inv.email) then raise exception 'This browser is signed in to a different account. Open a fresh sign-in link for the invited email.' using errcode='42501'; end if;
 return jsonb_build_object('email',account_email,'organization_id',inv.organization_id,'role',inv.role);
end $$;
revoke all on function private.invitation_identity(text) from public,anon,authenticated;
grant execute on function private.invitation_identity(text) to authenticated;
create or replace function public.invitation_identity(p_token text) returns jsonb language sql security invoker set search_path='' as $$select private.invitation_identity(p_token)$$;
revoke all on function public.invitation_identity(text) from public,anon;
grant execute on function public.invitation_identity(text) to authenticated;
