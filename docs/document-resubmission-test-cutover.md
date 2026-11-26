# 書類再提出・検証環境接続
対象 Supabase: tgxrnrqxafytyqfwwsag (goldfirst-tokyo-test)。本番禁止。
## GAS
既存 LINE 受付 doPost の先頭（既存の try 内、LINE webhook 判定より前）に次を追加する。doPost を新設・置換しない。
```js
const gfResubmissionResponse = GF_DocumentResubmissionRoute_(e);
if (gfResubmissionResponse !== null) return gfResubmissionResponse;
```
既存承認ルートが未接続の場合のみ同様に GF_DocumentApprovalRoute_(e) を呼ぶ。
追加ファイル: GF_DocumentResubmissionBridge.gs, GF_DocumentResubmissionSave.gs。既存 GF_DocumentApprovalBridge.gs の GF_DocumentPrivateDrive_ と GF215/GF216 の依存関数が同じ検証プロジェクトに存在することを確認。Advanced Drive v3 必須。
スクリプトプロパティ GF_DOCUMENT_RESUBMISSION_WRITE_ENABLED は初期 NO。GF_DOCUMENT_BRIDGE_SECRET は検証専用の32文字以上のランダム値。GF_DOCUMENT_APPROVAL_SHEET_ID は検証台帳と GF215_BOOK_ID の一致を確認。GF216_PROD_FOLDER_ID は名前にかかわらず検証専用ルートを指定。実際の権限を確認するまで有効化しない。
## Supabase
gf-line-driver-vehicles-stage/index.ts と ../_shared/document-resubmission-bridge.ts を同時に配備。既存 LINE 認証の JWT gateway 設定を維持。既存表示用 detail-review は変更しない。
Secrets: GF_DOCUMENT_RESUBMISSION_BRIDGE_ENABLED=NO, GF_DOCUMENT_BRIDGE_SECRET (GAS と同じ検証専用値), GF_DOCUMENT_RESUBMISSION_BRIDGE_URL (検証 GAS /exec URL)。
## 検証
1. 無効状態で再提出が拒否され、既存 LINE/車両表示が正常。
2. 検証専用台帳・Drive・テスト受付・LINE 紐付けを確認後のみ両フラグを YES。
3. 合成 PDF で本人のみ保存、他人・郵送・不正署名・期限切れ・再送を拒否。
4. Drive 保存後に gf_record_document_attempt が提出履歴と submitted を一括更新。保存失敗では requested のまま。
5. スタッフ承認後に通知が消えることを確認。
6. 異常時は両フラグを NO に戻す。既存デプロイ・データは削除しない。
未確認: 実 GAS の編集 URL、依存関数、権限、Secrets、実デプロイ。上記は反映手順であり反映済みではない。
