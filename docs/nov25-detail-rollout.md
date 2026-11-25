# 申込詳細の移行手順

## 検証
- review/driver-mypage-nov25 の HTML を既存公開ページと別の検証用パスに公開する。既存 Pages の公開ブランチは変更しない。
- 検証 URL に detailReview=1 を付ける。LIFF のエンドポイント・認証条件を確認する。既存本番 LIFF は変更しない。
- 検証 API gf-line-driver-vehicles-detail-review は gf_mypage_applications を参照する。既存認証・車両参照は変更していない。
- 架空データまたは承認されたテスト本人の受付で表示確認する。実データの複製は禁止。
- node --test tests/line-driver-progress.test.mjs を実行する。

## 本番承認後のみ
1. 現行 GAS をバックアップし、GF_SB_v4API_ / GF_SB_v4全件_ / GF_SB_v4書込許可_ の実装と対象プロジェクトを照合する。
2. gf_mypage_applications_prod に application_area text, application_email text を追加する。既存 RLS を維持する。
3. integrations/gas/GF_ApplicationDetailSync.gs を追加し、GF_SB_申込詳細同期プレビュー を実行する。件数のみ確認する。
4. 承認後に GF_SB_APPLICATION_DETAIL_ENABLE=YES を設定し、GF_SB_申込詳細同期 を実行する。50件ずつ処理し残件数が0になるまで確認する。
5. 新規受付の既存同期経路への統合と定期同期は別途検証後に実施する。現段階では自動同期されない。
6. 本人認証済み画面で稼働エリア・申込時メールアドレス・既存契約状態を確認する。
7. 問題時は新規同期を停止し、旧 API と HTML に戻す。追加列は削除しない。

## 未完了
Pages公開、実LINE認証、実GAS実行、実データ同期、本番移行は未実施。検証用APIは公開済み。コードテスト14件は模擬実行環境で合格。