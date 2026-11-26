-- Review migration only; do not apply to production without approval.
-- One independent request per receipt/document, with immutable request identity.
create table if not exists public.gf_driver_document_review_requests (
 id uuid primary key default gen_random_uuid(),
 receipt_id text not null,
 driver_id text not null,
 document_type text not null check(document_type in ('residence_certificate','driver_license')),
 reason text not null check(length(trim(reason)) between 1 and 1000),
 status text not null default 'requested' check(status in ('requested','submitted','approved')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists gf_document_review_one_open
 on public.gf_driver_document_review_requests(receipt_id,document_type)
 where status in ('requested','submitted');
alter table public.gf_driver_document_review_requests enable row level security;
revoke all on public.gf_driver_document_review_requests from public,anon,authenticated;
grant select,insert,update on public.gf_driver_document_review_requests to service_role;
-- Server must verify receipt ownership and staff permission before every mutation.
-- Uploads must remain private; do not expose object paths in driver notice responses.
