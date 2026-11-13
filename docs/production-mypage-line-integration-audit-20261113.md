# GOLD FIRST 本番マイページとLINE認証の統合確認（2026-11-13）

## 調査結果（読み取り専用）
- 本番 Supabase: goldfirst-tokyo-test / tgxrnrqxafytyqfwwsag
- デモ Supabase: goldfirst-demo / zwprphmfgobkektzsuti
- 本番 gf_driver_match_master_prod: 175件
- 本番 gf_mypage_links: 6件
- 本番 gf_mypage_applications_prod: 22件
- 本番 gf_line_driver_identity_prod: 0件
- 本番DBには gf_complete_line_mypage_challenge と gf_link_mypage_from_verified_line が既存。
- 既存 index.html は本番 gf_mypage_links と gf_mypage_applications_prod を利用し、メールOTP・申込状況・契約状況を表示。
- デモでは LINE Login → デモ用DriverID → デモ申込データ → 既存画面構成への表示を確認済み。

## 統合方針
1. 本番 index.html の既存メールOTP、登録申請、申込表示を維持する。
2. 本番用LINE LoginチャネルとLIFFだけを使用する。デモ用チャネルID、デモDBの鍵、デモDriverIDを本番へ移さない。
3. 本番の gf_line_driver_identity_prod に、受付元の検証済みLINEユーザーIDと、信頼できるDriverIDの対応情報を安全に供給する経路を作る。
4. 既存の gf_complete_line_mypage_challenge → gf_link_mypage_from_verified_line → gf_mypage_links の経路を再利用する。
5. 既存の紐づけ6件を変更・上書きしない。衝突はエラーで止め、管理者確認へ回す。
6. 既存の本番申込情報22件はデモ環境に複製しない。本人が許可されたデータのみ表示する。
7. 本番反映前に、既存の本番Edge FunctionのLINEチャネル検証、LIFF URL、CORS、本人確認トークン、RLS、権限を読み取り専用で確認する。

## 検証項目
- 既存ログインユーザーのマイページ表示が変わらない
- 新規LINE本人確認済みユーザーが対応するDriverIDにのみ紐づく
- 別人のLINE IDや別DriverIDの取得を拒否
- 既存リンクとの衝突を拒否
- 申込情報のないDriverIDは「連携待ち」
- デモ・本番の認証情報とデータを混在させない

## 現状
本番データ・本番コード・本番LINE設定への変更は未実施。次は本人確認済みのLINE ID→DriverIDの供給経路を検証する。
