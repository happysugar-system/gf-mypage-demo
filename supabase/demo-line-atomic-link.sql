-- Apply ONLY to a separate, dedicated DEMO Supabase project.
-- This RPC is callable by service_role only, never directly by a browser.
-- Requires gf_demo_line_challenges, gf_demo_line_identities, gf_demo_driver_profiles,
-- and gf_demo_mypage_links from demo-line-isolated.sql.
create or replace function public.gf_demo_complete_line_challenge(
 p_token_hash text, p_line_user_id text
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare
 v_auth uuid;
 v_driver text;
 v_existing_driver text;
begin
 if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_line_user_id is null or p_line_user_id !~ '^U[0-9a-fA-F]{32}$' then
   raise exception 'Invalid verification';
 end if;
 select c.auth_user_id into v_auth
 from public.gf_demo_line_challenges c
 where c.token_hash=p_token_hash and c.consumed_at is null and c.expires_at>now()
 for update;
 if v_auth is null then raise exception 'Challenge invalid or expired'; end if;
 if not exists(select 1 from auth.users u
               where u.id=v_auth and u.email_confirmed_at is not null)
 then raise exception 'Verified email login required'; end if;
 select i.driver_id into v_driver
 from public.gf_demo_line_identities i
 join public.gf_demo_driver_profiles d on d.driver_id=i.driver_id
 where i.line_user_id=p_line_user_id;
 if v_driver is null then raise exception 'Trusted demo identity mapping unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_auth::text,2026111301));
 perform pg_advisory_xact_lock(hashtextextended(v_driver,2026111302));
 select l.driver_id into v_existing_driver
 from public.gf_demo_mypage_links l where l.auth_user_id=v_auth for update;
 if v_existing_driver is not null and v_existing_driver<>v_driver
 then raise exception 'Auth account already linked to another driver'; end if;
 if exists(select 1 from public.gf_demo_mypage_links l
           where l.driver_id=v_driver and l.auth_user_id<>v_auth)
 then raise exception 'Driver already linked to another account'; end if;
 insert into public.gf_demo_mypage_links(auth_user_id,driver_id)
 values(v_auth,v_driver)
 on conflict(auth_user_id) do nothing;
 update public.gf_demo_line_challenges
 set consumed_at=now()
 where token_hash=p_token_hash and consumed_at is null;
 if not found then raise exception 'Challenge already consumed'; end if;
 return true;
end $$;
revoke all on function public.gf_demo_complete_line_challenge(text,text) from public,anon,authenticated;
grant execute on function public.gf_demo_complete_line_challenge(text,text) to service_role;
