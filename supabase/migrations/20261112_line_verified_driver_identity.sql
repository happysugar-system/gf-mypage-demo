-- GOLD FIRST / LINE verified identity mapping, stage for reviewed migration
-- SECURITY: LINE ID itself is not authentication. Only a server-verified LINE id_token
-- and a Supabase Auth session may call the service_role-only linking RPC.
create table if not exists public.gf_line_driver_identity_prod (
  line_user_id text primary key check(line_user_id ~ '^U[0-9a-fA-F]{32}$'),
  driver_id text not null unique check(driver_id ~ '^D[0-9]{6}$'),
  receipt_id text not null,
  line_reception_id text not null,
  source_key text not null unique check(source_key ~ '^[a-fA-F0-9]{64}$'),
  synced_at timestamptz not null default now()
);
alter table public.gf_line_driver_identity_prod enable row level security;
revoke all on public.gf_line_driver_identity_prod from public, anon, authenticated;

create or replace function public.gf_link_mypage_from_verified_line(
  p_auth_user_id uuid, p_line_user_id text
) returns text language plpgsql security definer set search_path='' as $$
declare
  v_id text; v_name text; v_phone text; v_existing text;
  v_old_status text; v_old_name text;
begin
  if p_auth_user_id is null or p_line_user_id !~ '^U[0-9a-fA-F]{32}$' then
    raise exception 'Identity verification failed';
  end if;

  -- Supabase email login was verified; LINE token was verified separately
  -- by trusted Edge Function. No untrusted browser values are used to pick DriverID.
  if not exists(select 1 from auth.users u
    where u.id=p_auth_user_id and u.email_confirmed_at is not null)
  then raise exception 'Verified account required'; end if;

  -- Stable locking order, plus unique indexes, prevent account theft during races.
  perform pg_advisory_xact_lock(hashtextextended(p_auth_user_id::text,2026111201));

  select m.driver_id,d.full_name,d.phone_number
    into v_id,v_name,v_phone
  from public.gf_line_driver_identity_prod m
  join public.gf_driver_match_master_prod d on d.driver_id=m.driver_id
  where m.line_user_id=p_line_user_id;

  if v_id is null or nullif(btrim(v_name),'') is null
  then raise exception 'Verified account mapping unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_id,2026111202));
  if exists(select 1 from public.gf_mypage_links l
            where l.driver_id=v_id and l.auth_user_id<>p_auth_user_id)
  then raise exception 'Already linked to another account'; end if;
  select l.driver_id into v_existing from public.gf_mypage_links l
  where l.auth_user_id=p_auth_user_id;
  if v_existing is not null and v_existing<>v_id
  then raise exception 'Existing account link conflict'; end if;

  -- Never override a mismatched application identity: it requires review.
  select r.status,r.full_name into v_old_status,v_old_name
  from public.gf_mypage_registration_requests r
  where r.auth_user_id=p_auth_user_id for update;
  if v_old_status='rejected'
  then raise exception 'Previously rejected account requires review'; end if;
  if nullif(btrim(coalesce(v_old_name,'')),'') is not null
     and regexp_replace(v_old_name,'[[:space:]　]+','','g')
       <> regexp_replace(v_name,'[[:space:]　]+','','g')
  then raise exception 'Application name conflict'; end if;

  if v_existing is null then
    insert into public.gf_mypage_links(auth_user_id,driver_id)
    values (p_auth_user_id,v_id);
  end if;

  insert into public.gf_mypage_registration_requests(
    auth_user_id,status,created_at,reviewed_at,full_name,phone_number)
  values (p_auth_user_id,'approved',now(),now(),v_name,v_phone)
  on conflict(auth_user_id) do update
    set status='approved',reviewed_at=now(),
        full_name=excluded.full_name,
        phone_number=excluded.phone_number;

  return v_id;
end
$$;

revoke execute on function public.gf_link_mypage_from_verified_line(uuid,text)
  from public,anon,authenticated;
grant execute on function public.gf_link_mypage_from_verified_line(uuid,text)
  to service_role;
