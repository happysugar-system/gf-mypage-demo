-- Automatic contact-change approval is only for identity-verified existing links.
-- Leaves old pending requests untouched. GAS writes Sheet only after rechecking.
create or replace function public.gf_auto_accept_verified_contact_request()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_count integer; v_reg text; v_full_name text; v_master_name text;
begin
  -- INSERT is initially pending and already passed user's RLS policy.
  -- The AFTER trigger upgrades only the user's own previously verified link.
  if NEW.status <> 'pending' or NEW.processed_at is not null
     or NEW.auth_user_id is null
     or NEW.driver_id !~ '^D[0-9]{6}$'
  then return null; end if;

  -- Do not automatically accept malformed or empty updates.
  if (NEW.requested_phone is null and NEW.requested_email is null)
     or (NEW.requested_phone is not null
          and NEW.requested_phone !~ '^0[0-9]{9,10}$')
     or (NEW.requested_email is not null
          and (length(NEW.requested_email) > 254
            or NEW.requested_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
  then return null; end if;

  select count(*) into v_count from public.gf_mypage_links l
   where l.auth_user_id=NEW.auth_user_id and l.driver_id=NEW.driver_id;
  if v_count <> 1 then return null; end if;
  select r.status,r.full_name into v_reg,v_full_name
    from public.gf_mypage_registration_requests r
    where r.auth_user_id=NEW.auth_user_id;
  if v_reg <> 'approved' or nullif(trim(coalesce(v_full_name,'')),'') is null
  then return null; end if;

  select count(*),max(m.full_name) into v_count,v_master_name
  from public.gf_driver_match_master_prod m where m.driver_id=NEW.driver_id;
  if v_count <> 1 or
     regexp_replace(v_full_name,'[[:space:]　]+','','g') <>
     regexp_replace(v_master_name,'[[:space:]　]+','','g')
  then return null; end if;

  -- Only trusted, linked, approved users get automatic eligibility.
  update public.gf_mypage_contact_change_requests
    set status='approved',
        processing_note='マイページ本人確認済み・スプシ反映待ち'
    where id=NEW.id and auth_user_id=NEW.auth_user_id and status='pending'
      and processed_at is null;
  return null;
end;
$$;
revoke execute on function public.gf_auto_accept_verified_contact_request()
  from public,anon,authenticated;
drop trigger if exists gf_mypage_auto_accept_contact on public.gf_mypage_contact_change_requests;
create trigger gf_mypage_auto_accept_contact
after insert on public.gf_mypage_contact_change_requests
for each row execute function public.gf_auto_accept_verified_contact_request();

-- Safe legacy self-link: only previously recorded, unique, verified email.
-- No self-entered name/DriverID is an independent proof.
create or replace function public.gf_mypage_claim_existing_verified_email()
returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_email text; v_confirmed timestamptz;
        v_driver_id text; v_master_name text; v_master_phone text;
        v_matches integer; v_existing text; v_status text; v_name text;
begin
  v_user := (select auth.uid());
  if v_user is null then return false; end if;
  select lower(trim(u.email)),u.email_confirmed_at
    into v_email,v_confirmed from auth.users u where u.id=v_user;
  if v_confirmed is null or v_email is null or v_email=''
    then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 2026111301));

  select count(*),max(m.driver_id),max(m.full_name),max(m.phone_number)
    into v_matches,v_driver_id,v_master_name,v_master_phone
  from public.gf_driver_match_master_prod m
    where nullif(lower(trim(m.email)),'')=v_email
    and nullif(trim(m.full_name),'') is not null;
  if v_matches <> 1 or v_driver_id !~ '^D[0-9]{6}$'
    then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_driver_id,2026111302));

  if exists(select 1 from public.gf_mypage_links l
     where (l.auth_user_id=v_user and l.driver_id is distinct from v_driver_id)
        or (l.driver_id=v_driver_id and l.auth_user_id is distinct from v_user))
  then return false; end if;

  select l.driver_id into v_existing from public.gf_mypage_links l
    where l.auth_user_id=v_user;
  select r.status,r.full_name into v_status,v_name
    from public.gf_mypage_registration_requests r
    where r.auth_user_id=v_user for update;
  if v_status='rejected' then return false; end if;
  if nullif(trim(coalesce(v_name,'')),'') is not null and
     regexp_replace(v_name,'[[:space:]　]+','','g') <>
     regexp_replace(v_master_name,'[[:space:]　]+','','g')
  then return false; end if;

  if v_existing is null then
    insert into public.gf_mypage_links(auth_user_id,driver_id)
    values(v_user,v_driver_id);
  end if;
  insert into public.gf_mypage_registration_requests
    (auth_user_id,status,created_at,reviewed_at,full_name,phone_number)
  values(v_user,'approved',now(),now(),v_master_name,v_master_phone)
  on conflict(auth_user_id) do update
    set status='approved',reviewed_at=now(),
        full_name=excluded.full_name,phone_number=excluded.phone_number;
  return true;
end;
$$;
revoke execute on function public.gf_mypage_claim_existing_verified_email()
 from public,anon,authenticated;
grant execute on function public.gf_mypage_claim_existing_verified_email()
 to authenticated;
