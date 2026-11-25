-- Review only. Private pending submissions; no replacement of official documents.
create table if not exists public.gf_driver_document_resubmissions (
 id uuid primary key default gen_random_uuid(),
 driver_id text not null,
 receipt_id text not null,
 document_type text not null check(document_type in ('residence_certificate','driver_license')),
 object_path text not null unique,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now()
);
alter table public.gf_driver_document_resubmissions enable row level security;
revoke all on public.gf_driver_document_resubmissions from anon, authenticated;
grant select,insert,update,delete on public.gf_driver_document_resubmissions to service_role;
-- Storage bucket must be private and separately verified before enabling uploads.
