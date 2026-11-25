-- Review migration; do not apply to production without approval.
create table if not exists public.gf_driver_notices (
 id bigint generated always as identity primary key,
 body text not null check (char_length(body) between 1 and 1000),
 enabled boolean not null default false,
 starts_at timestamptz not null default now(),
 ends_at timestamptz,
 check (ends_at is null or ends_at > starts_at)
);
alter table public.gf_driver_notices enable row level security;
revoke all on public.gf_driver_notices from anon, authenticated;
grant select, insert, update, delete on public.gf_driver_notices to service_role;
-- Access only via authenticated server-side endpoints; no direct browser access.
