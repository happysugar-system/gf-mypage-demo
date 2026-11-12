-- Existing drivers originally registered from license scans have no LINE pairing.
-- Enable account claiming with privately delivered, 256-bit one-use invitations.
-- This does NOT auto-link anybody or expose the original license images.
create table if not exists public.gf_mypage_existing_driver_invites(
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  driver_id text not null check (driver_id ~ '^D[0-9]{6}$'),
  issued_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id)
);
create index if not exists gf_existing_driver_invites_driver
  on public.gf_mypage_existing_driver_invites(driver_id,created_at desc);
alter table public.gf_mypage_existing_driver_invites enable row level security;
revoke all on public.gf_mypage_existing_driver_invites from public,anon,authenticated;
grant select,insert,update,delete on public.gf_mypage_existing_driver_invites to service_role;

-- Only the Edge Function can call this function, AFTER a valid Supabase
-- email login and 43-char random code are verified server-side.
create or replace function public.gf_redeem_existing_driver_invite(
  p_auth_user_id uuid,p_code_hash text
) returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_driver_id text; v_name text; v_phone text; v_status text; v_old_name text;
  v_old_driver_id text; v_count integer;
begin
  if p_auth_user_id is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  if not exists(select 1 from auth.users u
      where u.id=p_auth_user_id and u.email_confirmed_at is not null)
  then return false; end if;

  -- Same invite cannot be redeemed twice, even by concurrent sessions.
  select i.driver_id into v_driver_id
  from public.gf_mypage_existing_driver_invites i
  where i.code_hash=p_code_hash and i.redeemed_at is null
    and i.expires_at>now()
  for update;
  if v_driver_id is null then return false; end if;

  select count(*),max(m.full_name),max(m.phone_number)
    into v_count,v_name,v_phone
    from public.gf_driver_match_master_prod m where m.driver_id=v_driver_id;
  if v_count<>1 or nullif(trim(coalesce(v_name,'')),'') is null
  then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_auth_user_id::text,2026111301));
  perform pg_advisory_xact_lock(hashtextextended(v_driver_id,2026111302));
  if exists(select 1 from public.gf_mypage_links l
      where (l.auth_user_id=p_auth_user_id and l.driver_id is distinct from v_driver_id)
         or (l.driver_id=v_driver_id and l.auth_user_id is distinct from p_auth_user_id))
  then return false; end if;

  select l.driver_id into v_old_driver_id from public.gf_mypage_links l
    where l.auth_user_id=p_auth_user_id;
  select r.status,r.full_name into v_status,v_old_name
    from public.gf_mypage_registration_requests r
    where r.auth_user_id=p_auth_user_id for update;
  if v_status='rejected' then return false; end if;
  if nullif(trim(coalesce(v_old_name,'')),'') is not null
     and regexp_replace(v_old_name,'[[:space:]　]+','','g')<>
       regexp_replace(v_name,'[[:space:]　]+','','g') then return false; end if;

  if v_old_driver_id is null then
    insert into public.gf_mypage_links(auth_user_id,driver_id)
    values(p_auth_user_id,v_driver_id);
  end if;
  insert into public.gf_mypage_registration_requests
    (auth_user_id,status,created_at,reviewed_at,full_name,phone_number)
    values(p_auth_user_id,'approved',now(),now(),v_name,v_phone)
    on conflict(auth_user_id) do update set status='approved',
       reviewed_at=now(),full_name=excluded.full_name,
       phone_number=excluded.phone_number;

  update public.gf_mypage_existing_driver_invites
     set redeemed_at=now(),redeemed_by=p_auth_user_id
     where code_hash=p_code_hash and redeemed_at is null;
  return found;
end;
$$;
revoke execute on function public.gf_redeem_existing_driver_invite(uuid,text)
  from public,anon,authenticated;
grant execute on function public.gf_redeem_existing_driver_invite(uuid,text)
  to service_role;
