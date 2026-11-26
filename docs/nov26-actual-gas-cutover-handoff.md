# GOLD FIRST 2026-11-26: 実GASへの反映前ハンドオフ（現場環境を誤認しない）

## 現時点
- 納車管理: `gf-ledger` の `test/dynamic-assignment-cutover-20261125` に署名付き GAS 受信・検証台帳読取・納車完了履歴・月別再集計の候補コードが存在する（コミット `2270b270290d158b14035c9fa27b5602b11ce793`）。**実GASへの設置・操作テストは未確認**。
- 通知: `gf-mypage-demo` の `review/driver-mypage-nov25` に LINE ログイン済み本人限定通知の検証コードが存在する（コミット `1a47106217972091fd21c80e738441cbc50f62d8`）。認証後の実画面は未確認。
- 書類: 既存 LINE 受付 GAS には `doPost(e)` 内から `GF_DocumentCombinedRoute_(e)` を呼ぶ箇所が**既に１つある**。以前ユーザーが `GF_DocumentRouterStopOnly.gs` を貼り付けて `GF_DocumentStopOnlyCheck` の PASS を確認した。現行は停止用ルートとして扱う。**同名関数を重複追加してはいけない**。
- **注意**: 同じディレクトリの `DEMO_INSTALL.md` は DEMO 専用の古い前提で、実際の LINE 受付 GAS を DEMO と見なしてはいけない。確認済みの独立した LINE 受付「DEMO」GAS は存在しない。手順にある `GF_DOCUMENT_ENV=DEMO` 等を実GASへ機械的に設定しない。

## 納車管理: １回でまとめる利用者側 GAS 作業
1. 検証用スプレッドシートの「拡張機能 → Apps Script」から**実際の検証台帳に接続したGAS**を開き、スクリプトIDとバインド元を確かめる。本番台帳でないことを確認する。
2. `gf-ledger/integrations/monthly-delivery/` にある次の６つを同名で追加・更新（既存同名関数はコピーを重ねずに置換）:
   `GF_DeliveryCompletionRoute.gs`, `GF_DeliveryCompletionSave.gs`, `GF_DeliveryCompletionPlan.gs`, `GF_MonthlyDeliveryHistory.gs`, `GF_MonthlyDeliveryPlan.gs`, `GF_MonthlyDeliveryReport.gs`。
   `GF_ReceiptAssignmentValidationBook_` および `GF_ReceiptAssignmentReadTables_` の実在、Sheets API v4 の有効化も確認する。存在しなければ**設定のまま停止**し、不明な本番ヘルパーで代用しない。
3. 既存 `doPost(e)` がある場合に**１箇所のみ**、通常ルートの分岐前へ次を加える。新しい `doPost` 関数は作らない:
   ```js
   const deliveryResponse = GF_DeliveryCompletionRoute_(e);
   if (deliveryResponse !== null) return deliveryResponse;
   ```
4. スクリプトプロパティ `GF_DELIVERY_VALIDATION_BOOK_ID` を検証用ブックIDに設定し、`GF_DELIVERY_BRIDGE_SECRET` を検証専用の十分長いランダム値にする。`GF_DELIVERY_WRITE_ENABLED=NO` のまま検証用デプロイ更新。シークレットはチャットへ貼らない。
5. 対応する検証 Supabase で `GF_DELIVERY_BRIDGE_URL` と同じシークレットを設定し、`GF_DELIVERY_VALIDATION_READ_ENABLED=YES`（読み取りのみ）で台帳との一致確認。成功・対象の一意性を確認してから、検証環境で**両側** `GF_DELIVERY_WRITE_ENABLED=YES` とし合成データ１件だけで「完了→実績履歴→再集計」を確認する。検証終了時は書込両側を `NO` に戻す。
6. 公開 Pages は指定レビュー枝の変更が**公開されているか別途確認**する。GitHub にコミットがあることと公開 URL が更新済みであることは同義ではない。

## 書類再提出・承認: 誤導入の防止
- LINE 受付 GAS の既存 `doPost` に `GF_DocumentCombinedRoute_(e)` 呼び出しを**再追加しない**。
- `GF_DocumentRouterStopOnly.gs` の停止処理を、コードや設定の検証なしに動作版 `GF_DocumentCombined.gs` と共存させない。同名関数が衝突する。
- 既存の LINE 受付 GAS が実際に参照する受付表、証憑フォルダ、実行権限を特定し、**テスト専用データの独立を確認できるまでは書込フラグを絶対に YES にしない**。
- 現行の Supabase 書類再提出エンドポイントは停止版デプロイの可能性がある。GitHub 機能実装だけで「アップロード・承認動作済み」としない。
- 検証は本人の模擬受付１件に限定し、「再提出→スタッフ承認→本人通知消去」を一連で確認する。郵送の住民票はアップロード案内を出さない。本番変更は別途承認。

## 操作URL（反映済みは未確認）
- スタッフ検証画面: https://happysugar-system.github.io/gf-ledger/vehicle-driver-management-integration-live-test.html
- ドライバーマイページ検証画面: https://happysugar-system.github.io/gf-mypage-demo/driver-mypage-nov25-review.html

## 完了判定
コード保管 ≠ GASへの反映 ≠ Supabaseデプロイ ≠ 実画面の操作成功。各状態を分けて報告する。本番へは明示承認前に反映しない。
