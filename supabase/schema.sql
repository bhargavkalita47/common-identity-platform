-- Common Identity Platform. Apply once to a NEW Supabase project using SQL Editor.
-- Never apply to Recruider. All application mutations run with the user's JWT.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create extension if not exists pgcrypto with schema extensions;

create type public.org_role as enum ('owner','admin','member','viewer');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=100),
 email text not null,
 created_at timestamptz not null default now()
);
create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 80),
 description text not null default '' check(length(description)<=300),
 created_at timestamptz not null default now()
);
create table public.organization_members (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete restrict,
 role public.org_role not null,
 joined_at timestamptz not null default now(),
 primary key(organization_id,user_id)
);
create index members_user_idx on public.organization_members(user_id,organization_id);
create table public.invitations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 email text not null check(length(email)<=254),
 role public.org_role not null check(role<>'owner'),
 token_hash text not null unique,
 status text not null default 'pending' check(status in ('pending','accepted','declined','revoked')),
 invited_by uuid not null references auth.users(id) on delete restrict,
 expires_at timestamptz not null default now()+interval '7 days',
 created_at timestamptz not null default now()
);
create index invitations_org_idx on public.invitations(organization_id,created_at desc);
create unique index invitations_pending_email on public.invitations(organization_id,lower(email)) where status='pending';
create table public.resources (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 160),
 body text not null default '' check(length(body)<=20000),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index resources_org_idx on public.resources(organization_id,created_at desc);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 actor_id uuid,
 action text not null,
 target_id uuid,
 details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index audit_org_idx on public.audit_events(organization_id,created_at desc);

-- JWT alone is insufficient after revocation: check the live Auth session.
-- Maximum application session age is seven days, independently of plan limits.
create function private.active_uid() returns uuid language sql stable security definer set search_path='' as $$
 select u.id from auth.users u join auth.sessions s on s.user_id=u.id
 where u.id=auth.uid() and u.email_confirmed_at is not null
 and s.id=(auth.jwt()->>'session_id')::uuid
 and (s.not_after is null or s.not_after>now())
 and s.created_at>now()-interval '7 days'
$$;
create function private.my_role(p_org uuid) returns public.org_role language sql stable security definer set search_path='' as $$
 select role from public.organization_members where organization_id=p_org and user_id=private.active_uid()
$$;
create function private.shares_org(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_uid()=p_user or exists(
 select 1 from public.organization_members a join public.organization_members b using(organization_id)
 where a.user_id=private.active_uid() and b.user_id=p_user)
$$;
create function private.profile_created() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,email,display_name) values(new.id,new.email, left(coalesce(new.raw_user_meta_data->>'display_name',''),100));
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.profile_created();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.invitations enable row level security;
alter table public.resources enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_read on public.profiles for select to authenticated using(private.shares_org(id));
create policy profiles_update on public.profiles for update to authenticated using(id=private.active_uid()) with check(id=private.active_uid());
create policy organizations_read on public.organizations for select to authenticated using(private.my_role(id) is not null);
create policy members_read on public.organization_members for select to authenticated using(private.my_role(organization_id) is not null);
create policy invitations_read on public.invitations for select to authenticated using(private.my_role(organization_id) in ('owner','admin'));
create policy resources_read on public.resources for select to authenticated using(private.my_role(organization_id) is not null);
create policy resources_insert on public.resources for insert to authenticated with check(private.my_role(organization_id) in ('owner','admin') and created_by=private.active_uid());
create policy resources_update on public.resources for update to authenticated using(private.my_role(organization_id) in ('owner','admin','member')) with check(private.my_role(organization_id) in ('owner','admin','member'));
create policy resources_delete on public.resources for delete to authenticated using(private.my_role(organization_id) in ('owner','admin'));
create policy audit_read on public.audit_events for select to authenticated using(private.my_role(organization_id) in ('owner','admin'));

-- Explicit grants: no browser can directly mutate membership, invitations or audit.
revoke all on public.profiles,public.organizations,public.organization_members,public.invitations,public.resources,public.audit_events from anon,authenticated;
grant select on public.profiles,public.organizations,public.organization_members,public.resources,public.audit_events to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant select(id,organization_id,email,role,status,invited_by,expires_at,created_at) on public.invitations to authenticated;
grant insert(organization_id,title,body,created_by),update(title,body),delete on public.resources to authenticated;

create function private.resource_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.resources;
begin
 if tg_op='UPDATE' then
  if new.organization_id<>old.organization_id or new.created_by<>old.created_by then raise exception 'Resource ownership is immutable' using errcode='42501'; end if;
  new.updated_at=now();
 end if;
 if tg_op='DELETE' then r=old; else r=new; end if;
 insert into public.audit_events(organization_id,actor_id,action,target_id,details)
 values(r.organization_id,private.active_uid(),'resource.'||lower(tg_op),r.id,jsonb_build_object('title',r.title));
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger resource_activity before insert or update or delete on public.resources for each row execute function private.resource_audit();

create function private.create_org(p_name text,p_description text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid=private.active_uid(); oid uuid;
begin
 if uid is null then raise exception 'Verified active session required' using errcode='42501'; end if;
 if (select count(*) from public.organization_members where user_id=uid and role='owner')>=20 then raise exception 'Organization limit reached'; end if;
 insert into public.organizations(name,description) values(trim(p_name),p_description) returning id into oid;
 insert into public.organization_members values(oid,uid,'owner',now());
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(oid,uid,'organization.created',oid);
 return oid;
end $$;
create function public.create_organization(p_name text,p_description text default '') returns uuid language sql security invoker set search_path='' as $$select private.create_org(p_name,p_description)$$;

-- All membership writers acquire the organization lock BEFORE checking roles.
-- This also serializes competing owner demotions/removals.
create function private.org_command(p_org uuid,p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid=private.active_uid(); actor public.org_role; target uuid; target_role public.org_role; next_role public.org_role;
 inv public.invitations; token text; event_target uuid;
begin
 if uid is null then raise exception 'Active session required' using errcode='42501'; end if;
 perform 1 from public.organizations where id=p_org for update;
 actor=private.my_role(p_org);
 if actor is null then raise exception 'Organization unavailable' using errcode='42501'; end if;
 if p_action='rename' then
  if actor<>'owner' then raise exception 'Owner required' using errcode='42501'; end if;
  update public.organizations set name=trim(p_data->>'name'),description=coalesce(p_data->>'description','') where id=p_org;
  event_target=p_org;
 elsif p_action in ('role','remove') then
  target=(p_data->>'user_id')::uuid;
  select role into target_role from public.organization_members where organization_id=p_org and user_id=target;
  if target_role is null then raise exception 'Member unavailable'; end if;
  if actor not in ('owner','admin') or (actor='admin' and (target_role in ('owner','admin') or target=uid)) then raise exception 'Not permitted' using errcode='42501'; end if;
  if p_action='role' then
   next_role=(p_data->>'role')::public.org_role;
   if actor='admin' and next_role not in ('member','viewer') then raise exception 'Not permitted' using errcode='42501'; end if;
  end if;
  if target_role='owner' and (p_action='remove' or next_role<>'owner') and
   (select count(*) from public.organization_members where organization_id=p_org and role='owner')<=1
   then raise exception 'Organization must retain at least one owner' using errcode='23514'; end if;
  if p_action='remove' then delete from public.organization_members where organization_id=p_org and user_id=target;
  else update public.organization_members set role=next_role where organization_id=p_org and user_id=target; end if;
  event_target=target;
 elsif p_action='invite' then
  next_role=(p_data->>'role')::public.org_role;
  if actor not in ('owner','admin') or next_role='owner' or (actor='admin' and next_role='admin') then raise exception 'Not permitted' using errcode='42501'; end if;
  if (select count(*) from public.invitations where organization_id=p_org and created_at>now()-interval '1 hour')>=20 then raise exception 'Invitation limit reached. Try again later.'; end if;
  if not (p_data->>'email' ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') then raise exception 'Valid email required'; end if;
  update public.invitations set status='revoked' where organization_id=p_org and lower(email)=lower(trim(p_data->>'email')) and status='pending' and expires_at<=now();
  token=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.invitations(organization_id,email,role,token_hash,invited_by)
   values(p_org,lower(trim(p_data->>'email')),next_role,encode(extensions.digest(token,'sha256'),'hex'),uid) returning id into event_target;
 elsif p_action='revoke' then
  if actor not in ('owner','admin') then raise exception 'Not permitted' using errcode='42501'; end if;
  select * into inv from public.invitations where id=(p_data->>'id')::uuid and organization_id=p_org for update;
  if inv.id is null or inv.status<>'pending' then raise exception 'Pending invitation unavailable'; end if;
  if actor='admin' and inv.role='admin' then raise exception 'Owner required' using errcode='42501'; end if;
  update public.invitations set status='revoked' where id=inv.id;
  event_target=inv.id;
 else raise exception 'Unknown operation';
 end if;
 insert into public.audit_events(organization_id,actor_id,action,target_id,details)
 values(p_org,uid,'organization.'||p_action,event_target,p_data-'token');
 return jsonb_strip_nulls(jsonb_build_object('id',event_target,'token',token));
end $$;
create function public.organization_command(p_org uuid,p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.org_command(p_org,p_action,p_data)$$;

create function private.respond_invitation(p_token text,p_decision text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid=private.active_uid(); inv public.invitations; oid uuid; actual_email text;
begin
 if uid is null then raise exception 'Sign in with a verified account first' using errcode='42501'; end if;
 select organization_id into oid from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if oid is null then raise exception 'Invalid invitation'; end if;
 perform 1 from public.organizations where id=oid for update;
 select * into inv from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 select lower(email) into actual_email from auth.users where id=uid;
 if inv.status<>'pending' or inv.expires_at<=now() then raise exception 'Invitation expired or already used'; end if;
 if actual_email<>lower(inv.email) then raise exception 'Sign in with the invited email address' using errcode='42501'; end if;
 if p_decision not in ('accept','decline') then raise exception 'Invalid decision'; end if;
 if p_decision='accept' then
  -- Existing membership is preserved: an invitation never upgrades a current member.
  insert into public.organization_members(organization_id,user_id,role) values(oid,uid,inv.role) on conflict do nothing;
 end if;
 update public.invitations set status=case when p_decision='accept' then 'accepted' else 'declined' end where id=inv.id;
 insert into public.audit_events(organization_id,actor_id,action,target_id,details)
 values(oid,uid,'invitation.'||p_decision,inv.id,jsonb_build_object('email',inv.email,'role',inv.role));
 return oid;
end $$;
create function public.respond_invitation(p_token text,p_decision text) returns uuid language sql security invoker set search_path='' as $$select private.respond_invitation(p_token,p_decision)$$;

create function private.account_sessions() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid=private.active_uid();
begin
 if uid is null then raise exception 'Active session required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'created_at',s.created_at,'updated_at',s.updated_at,
 'user_agent',s.user_agent,'current',s.id=(auth.jwt()->>'session_id')::uuid,
 'expires_at',least(coalesce(s.not_after,s.created_at+interval '7 days'),s.created_at+interval '7 days')))
 from auth.sessions s where s.user_id=uid and (s.not_after is null or s.not_after>now()) and s.created_at>now()-interval '7 days'),'[]'::jsonb);
end $$;
create function public.account_sessions() returns jsonb language sql security invoker set search_path='' as $$select private.account_sessions()$$;
create function private.revoke_session(p_session uuid) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid=private.active_uid();
begin
 if uid is null then raise exception 'Active session required' using errcode='42501'; end if;
 delete from auth.sessions where id=p_session and user_id=uid;
end $$;
create function public.revoke_session(p_session uuid) returns void language sql security invoker set search_path='' as $$select private.revoke_session(p_session)$$;
create function public.active_account() returns uuid language sql security invoker set search_path='' as $$select private.active_uid()$$;

-- Deny default function execution, then allow only the intended entrypoints/helpers.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.active_uid(),private.my_role(uuid),private.shares_org(uuid),
 private.create_org(text,text),private.org_command(uuid,text,jsonb),private.respond_invitation(text,text),
 private.account_sessions(),private.revoke_session(uuid) to authenticated;
revoke all on function public.create_organization(text,text),public.organization_command(uuid,text,jsonb),
 public.respond_invitation(text,text),public.account_sessions(),public.revoke_session(uuid),public.active_account() from public,anon;
grant execute on function public.create_organization(text,text),public.organization_command(uuid,text,jsonb),
 public.respond_invitation(text,text),public.account_sessions(),public.revoke_session(uuid),public.active_account() to authenticated;

-- Auth success/failure events remain authoritative in Supabase Authentication logs.
-- Never trust client-authored authentication logs as a security record.
