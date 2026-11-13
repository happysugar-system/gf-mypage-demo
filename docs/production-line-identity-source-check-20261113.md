# GOLD FIRST LINE本人確認：本番の接続経路調査（2026-11-13）

## 読み取り専用の確認結果
- 本番プロジェクト: goldfirst-tokyo-test (tgxrnrqxafytyqfwwsag)
- 本番Edge Function gf-line-mypage-link version 5: ACTIVE、verify_jwt=false（関数内で本人検証）
- LINE Login channel ID は 2012019621（本番用）。デモ用2012058414ではない。
- begin: Supabase認証済みメールユーザーのみ5分間のワンタイムchallengeを作成、10分間に3件まで。
- complete: LINE公式 verify APIでIDトークンを検証し、LINE user IDをgf_complete_line_mypage_challenge RPCへ渡す。
- RPCはgf_link_mypage_from_verified_lineを呼び、gf_line_driver_identity_prodとgf_driver_match_master_prodの一致を要求。
- gf_line_driver_identity_prod: 0件。本人のLINE ID→DriverID対応データの投入元が未接続または未稼働。
- gf_mypage_links: 6件、gf_mypage_applications_prod: 22件、gf_driver_match_master_prod: 175件。
- gf-existing-driver-invite version 5もACTIVE。管理者発行のワンタイム招待方式で、LINE対応表とは別の既存紐づけ経路。

## 今後の作業
1. LINE公式アカウントの本番受付Webhook/GASが、LINEユーザーIDと受付番号をどこに保存しているか調べる。
2. 受付番号→DriverIDを信頼できるサーバー側の情報で一意に照合できるか検証。氏名・電話番号だけの自動一致は禁止。
3. 既存のgf_line_driver_identity_prodのsource_key、receipt_id、line_reception_id、driver_idへの同期経路をステージングで実装し、重複と衝突を拒否する。
4. 既存6件のリンクを維持。未確認のLINE IDを本番DBに登録しない。
5. 本番LIFF、認証API、マイページの順で限定的に動作確認後、公開を検討。

本番への変更：なし。
