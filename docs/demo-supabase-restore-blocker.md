# デモ用Supabase再開・接続手順

## 2026-11-13 実施結果
- `happysugarDEMO` project ID: `nsollcxoekrwkgsyvokd`
- `restore_project` attempted: **failed** with Supabase `ForbiddenException`.
- Reason: account has reached the **2 active free projects** limit.
- No existing project was paused, deleted or changed.
- GOLD FIRST project `tgxrnrqxafytyqfwwsag` remains untouched.

## 再開後の順番（この順でのみ）
1. Demo Supabase project is active and separately identified. Confirm no production data is present.
2. Apply `supabase/demo-line-isolated.sql`.
3. Apply `supabase/demo-line-atomic-link.sql`.
4. Configure Edge Function secret `GF_DEMO_LINE_LOGIN_CHANNEL_ID` using **DEMO LINE Login channel ID**, confirmed in LINE Developers (LIFF prefix alone is not proof of provider mapping).
5. Deploy `supabase/functions/gf-demo-line-mypage-link/index.ts` with `verify_jwt=false`, because the function verifies Supabase Auth on `begin` and LINE ID token on `complete` itself.
6. Provision demo-only `gf_demo_driver_profiles` and `gf_demo_line_identities` using independently verified trusted identity. Never import production identity mappings without explicit approval.
7. Create a demo My Page sign-in that uses **demo Supabase Auth** to request `begin` and forwards the challenge to `demo-line-identity-preview.html`.
8. Configure the demo preview's `DEMO_LINK_ENDPOINT` to the demo project Edge Function, after validating its URL. The current preview is intentionally disabled.
9. Verify valid mapping, missing mapping, wrong channel, duplicate accounts, expired/replayed challenge and concurrency.
10. Publish or migrate to production only with separate approval.

## Read-only post-deploy verification SQL
```sql
select 'demo_profiles' as item,count(*) from public.gf_demo_driver_profiles
union all select 'demo_line_identities',count(*) from public.gf_demo_line_identities
union all select 'demo_mypage_links',count(*) from public.gf_demo_mypage_links
union all select 'demo_challenges',count(*) from public.gf_demo_line_challenges;
```

## Safety
- Never use `goldfirst-tokyo-test` as a fallback for DEMO writes.
- Never pause or delete an unrelated project to free a slot without user approval.
- The Edge Function and SQL files in this branch are staged, **not deployed**.
