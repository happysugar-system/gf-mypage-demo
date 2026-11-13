-- DEMO ONLY. Apply to an ACTIVE, dedicated demo Supabase project.
-- Never apply to GOLD FIRST production or its shared data tables.
create table if not exists public.gf_demo_line_identities (
 line_user_id text primary key check (line_user_id ~ '^U[0-9a-fA-F]{32}$'),
 driver_id text not null unique,
 verified_by text not null,
 verified_at timestamptz not null default now()
);
create table if not exists public.gf_demo_driver_profiles (
 driver_id text primary key,
 display_name text not null
);
create table if not exists public.gf_demo_mypage_links (
 auth_user_id uuid primary key references auth.users(id) on delete cascade,
 driver_id text not null unique references public.gf_demo_driver_profiles(driver_id),
 created_at timestamptz not null default now()
);
create table if not exists public.gf_demo_line_challenges (
 token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
 auth_user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 consumed_at timestamptz
);
create index if not exists gf_demo_challenges_user_created_idx
 on public.gf_demo_line_challenges(auth_user_id,created_at desc);
alter table public.gf_demo_line_identities enable row level security;
alter table public.gf_demo_driver_profiles enable row level security;
alter table public.gf_demo_mypage_links enable row level security;
alter table public.gf_demo_line_challenges enable row level security;
revoke all on public.gf_demo_line_identities from anon,authenticated;
revoke all on public.gf_demo_driver_profiles from anon,authenticated;
revoke all on public.gf_demo_mypage_links from anon,authenticated;
revoke all on public.gf_demo_line_challenges from anon,authenticated;
-- All access is through the authenticated Edge Function with server-side checks.
-- Identity mappings must be populated only after independent trusted identity verification.
