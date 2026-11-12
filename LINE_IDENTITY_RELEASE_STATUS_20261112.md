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
