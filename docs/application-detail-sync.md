# Application detail sync
Source: 車両依頼受付 (existing GF_SB_受付ブック_ configuration; verify active book before deployment).
Add nullable text columns application_area and application_email to gf_mypage_applications_prod before deploying API or GAS. Do not grant new public access; inspect existing RLS and grants first.
In GF_SB_v4受付計画_ add required headers 稼働エリア and 契約者メールアドレス, and add application_area:val('稼働エリア'), application_email:val('契約者メールアドレス') to records.
For existing records use receipt_id AND confirmed driver_id, never name matching. Skip blank or mismatched driver IDs, duplicate receipt IDs and TEST- records. Update only the two new columns, never ownership or contract status. Do not log personal values. Preserve existing write guards and locks.
Verify active GAS version before applying this patch; archived v7 is not proof of current deployment.
Deploy order: isolated schema and RLS verification, GAS preview, controlled backfill, API deployment, own-driver and cross-driver tests, production approval.

## New receipts only — revised scope
Do not backfill historical test records. In the active GF_SB_v4受付計画_ function, add 稼働エリア and 契約者メールアドレス to the required header array and add application_area:val('稼働エリア'), application_email:val('契約者メールアドレス') to the existing records.push object. No separate helper or trigger is required for this inline variant. Preserve all existing fields, filters, locks and write guards. Verify the active GAS project and actual destination table before applying; the archived v7 source is not the active source. Verify both nullable columns exist on that destination. Do not change the destination to make test counts match. Test one newly created receipt with confirmed DriverID and verify the two fields through the existing authenticated mypage API. No historical backfill.
