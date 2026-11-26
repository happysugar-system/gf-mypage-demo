create table public.gf_driver_document_attempts (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.gf_driver_document_review_requests(id),
 drive_file_id text not null unique check (drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
 created_at timestamptz not null default now()
);
alter table public.gf_driver_document_attempts enable row level security;
revoke all on public.gf_driver_document_attempts from public, anon, authenticated;
grant select,insert on public.gf_driver_document_attempts to service_role;
create function public.gf_record_document_attempt(p_request uuid,p_driver text,p_file text) returns uuid language plpgsql security invoker set search_path='' as $$
declare attempt uuid;
begin
 update public.gf_driver_document_review_requests set status='submitted',updated_at=now() where id=p_request and driver_id=p_driver and status='requested';
 if not found then raise exception 'request_not_available'; end if;
 insert into public.gf_driver_document_attempts(request_id,drive_file_id) values(p_request,p_file) returning id into attempt;
 return attempt;
end $$;
revoke all on function public.gf_record_document_attempt(uuid,text,text) from public,anon,authenticated;
grant execute on function public.gf_record_document_attempt(uuid,text,text) to service_role;