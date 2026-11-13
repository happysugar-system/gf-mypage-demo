# GOLD FIRST DEMO LINE → My Page: isolated implementation plan (2026-11-13)

Status: **staging only; no deployment, no production writes**.

## Verified current connections
- DEMO LINE Login LIFF: `2012058414-X38FJPaP` (provider relationship with production must be verified).
- Existing `gf-ledger/vehicle-request-mypage-preview.html` currently uses PROD LIFF `2012019621-Gu0mOfuK`.
- Existing `gf-line-mypage-link` Edge Function v5 verifies LINE Login channel `2012019621`.
- Existing SQL `gf_complete_line_mypage_challenge` calls `gf_link_mypage_from_verified_line`, which reads `gf_line_driver_identity_prod` and writes `gf_mypage_links` and `gf_mypage_registration_requests`.
- PROD identity mapping is empty; the existing 175 driver records cannot independently establish ownership of LINE accounts.
- `138_LINE車両依頼_ドライバー自動登録` (saved 2026-10-30 version) has writes enabled and may create drivers; do not run for this test.

## Required isolation before connecting demo
1. Confirm DEMO LIFF provider and identity token `aud`; server-side validate `iss`, `aud`, `sub`, expiry using LINE verify endpoint.
2. Add a **separate demo-only** Edge Function and DB mapping. Never modify existing `gf-line-mypage-link` or `gf_line_driver_identity_prod`.
3. Demo challenge table and demo link table must be separate from production; add unique constraints for LINE user ID, DriverID and auth user ID; enforce 5-minute single-use challenges and rate limits.
4. Provision demo mapping only from an independently verified trusted registration event (or admin-confirmed bootstrap). **Do not infer verified identity from name, phone, email, or `GF142` candidate match alone.**
5. Use separate demo Supabase Auth and demo driver data where possible. If reusing a project, ensure no demo code can write `gf_mypage_links`, `gf_mypage_registration_requests`, or production master.
6. A separate demo preview page should call only the demo function and use demo LIFF. Do not replace the live form or change published GitHub Pages until tested.
7. Test: correct identity, unknown identity, ambiguous match, replay, expired token, cross-account conflict, wrong LIFF audience, duplicate submission, lost network, and parallel requests.
8. Promote to production only after explicit approval and audited rollout.

## Implementation gate
The production mapping has 0 rows and the exact DEMO LINE Provider / channel ID token audience has not yet been confirmed in this staging review. No safe automatic link can be enabled until those are established.
