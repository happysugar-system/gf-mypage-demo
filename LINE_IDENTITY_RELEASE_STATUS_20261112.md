# GOLD FIRST LINE本人確認 → マイページ（2026-11-12）

## 本番に実施済み
- Supabase プロジェクト `tgxrnrqxafytyqfwwsag` へ専用テーブルとRPCを適用済み。
- Edge Function `gf-line-mypage-link` v1 ACTIVE。
- `gf_line_driver_identity_prod`（LINEユーザーID⇔DriverID）は現状 **0件**。
- `gf_mypage_line_challenges`（一度きり連携）は現状 **0件**。
- 既存 `gf_mypage_links` 6件は変更・削除なし。
- 2テーブルはRLS ON、`anon`・`authenticated`に直接アクセス権なし。
- 本人紐付けRPCは `service_role` だけが実行可能。
- メール認証→5分有効チャレンジ→LINE id_tokenサーバー検証→DBトランザクションで本人紐付け。
- 異なるDriverIDへの上書き・同一チャレンジ再利用は拒否。

## コード準備済み・本番未公開
- このGitHubブランチ `feature/line-verified-driver-link` に、
  `index.html` と `mypage-prod-test.html` のLINE確認ボタン。
- 別GitHub `gf-ledger` の `feature/mypage-line-verified-link` に既存LIFFの受け渡し画面。
- 別GitHub `gf-gas-test` の `feature/mypage-self-link-contact-sync` に
  `157_LINE本人対応_本番履歴同期.js`（初期状態READ_ONLY）。
- LINE本人対応のGASは本番未pushで、マッピングデータも未同期。
- 連絡先変更の `156_...` も初期状態READ_ONLYで本番スプシの更新は未稼働。

## 本番連携前の必要条件
1. 本番GASに変更を安全反映し、GF157のREAD_ONLYプレビューを取得。
2. 本番GF138履歴「登録済」＋受付識別子＋LINE受付管理のLINEユーザーID＋ドライバー備考`GF_LINE_REQ`を一致確認。
3. LINE Loginチャネルと公式LINE Messaging APIチャネルが**同一プロバイダー**であることを確認。異なるプロバイダーではユーザーIDが一致しない。
4. GAS Script Propertiesへ `GF_MYPAGE_SB_URL`、`GF_MYPAGE_SB_SERVICE_ROLE_KEY` を秘密情報として設定。秘密キーはGitHub・チャットに貼らない。
5. 1件の正常受付と、矛盾・二重リンク・期限切れの拒否を安全に確認してからGF157の書込を有効化。
6. LIFF経由の `gf_mypage_link`＋使い捨てチャレンジがLINE in-app browserで引き継がれるか確認。**この検証前にGitHub Pagesのmainブランチへ画面変更を反映しない。**

## 注意
本人確認の未完成状態でマイページを外部公開しない。GAS・Supabaseの既存データを勝手に変更しない。

## Existing license-based drivers and contact update: added 2026-11-12

Already deployed to Supabase (no existing links modified):
- gf_mypage_claim_existing_verified_email: preexisting, unique, verified email match only
- gf_mypage_existing_driver_invites + gf_redeem_existing_driver_invite: one-time 256-bit invitation codes, 7-day expiry, server-side redeem, no plaintext DB storage
- gf-existing-driver-invite Edge Function v1 ACTIVE, admin-only issue, authenticated redeem
- gf_auto_accept_verified_contact_request: automatically approves contact changes for the same approved user and uniquely matched master driver
- Current master: 171 drivers, 4 with email, 5 with phone; existing links 6; invitations 0; LINE mappings 0

GitHub staged (not yet published):
- Existing driver one-time-code entry in index.html and mypage-prod-test.html
- Admin code issuance form in admin-registrations.html
- Existing drivers without vehicle-request records see contact view after trusted linking
- GF156 on gf-gas-test feature branch: safe config diagnostics and guarded 10-minute trigger installer; WRITE remains false
- GF157 on gf-gas-test feature branch: requires GF157_GO_LIVE_YYYYMMDD before export; WRITE remains false

Required checks before enabling or publishing:
1. Verify same LINE provider for LIFF Login and Messaging API user IDs
2. Confirm trusted delivery of a single existing-driver invite to an actual driver; never distribute codes based on name and DriverID alone
3. Run read-only production GAS preflight before deploying GF156/GF157 updates
4. Set GF_MYPAGE_SB_URL and GF_MYPAGE_SB_SERVICE_ROLE_KEY in GAS Script Properties privately; never post service key in chat or GitHub
5. Execute GF_MYPAGE_連絡先同期_設定診断(), then test a non-sensitive permitted contact request before enabling writes and a single 10-minute trigger
6. After first real vehicle-request form registration, verify end-to-end LINE ID → DriverID matching with no legacy test history
7. Review frontend pages and reject replay, expired invite, wrong account, mismatched LINE token, and duplicate links before publishing GitHub Pages

Automated email link cannot work for the majority of legacy drivers without preexisting trusted contact data. Do not weaken identity proof.
