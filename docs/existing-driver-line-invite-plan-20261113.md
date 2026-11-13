# GOLD FIRST｜既存ドライバー初回LINE連携（デモ実装仕様）

## 方針（2026-11-13）
- 既存ドライバー：GOLD FIRSTが本人確認済みの連絡先に、DriverIDに紐付く一度きりの招待リンクを個別送付。管理者による申請承認は不要。
- 新規ドライバー：車両依頼フォームから作成されたDriverIDと、依頼に使ったLINE userIdをサーバー側で連携。
- 初回完了後：LINEログインからDriverIDを解決し、本人のマイページを表示。
- 免許証OCR、メールOTP、氏名・生年月日だけによる自動紐付けは使用しない。

## 既存実装の確認
- DEMO Supabase zwprphmfgobkektzsuti に gf_demo_line_identities（line_user_id→driver_id）と gf-demo-line-mypage-link Edge Function が存在。
- gf-demo-line-mypage-link は LINE ID token を LINE API で検証する。ただし現行 complete は「事前登録済みLINE ID→DriverID」を前提とするため、既存ドライバー向け招待リンク発行・引換の追加が必要。
- gf-mypage-demo の feature/line-verified-driver-link には既存ドライバー招待コードUIがあるが、現状は本番 Supabase のメール認証と gf-existing-driver-invite に依存する。これをそのまま本番公開しない。

## 実装ステップ（本番変更禁止）
1. デモ専用の招待テーブルを追加。driver_id、ランダムトークンのSHA-256、発行・期限・使用日時、発行者を保存。生トークンはDBに保存しない。DriverIDはユニークな既存マスターに照合する。
2. 招待リンク発行はGOLD FIRST管理者のみ可能にする。LINEトークンをURLに直書きせず、短命・一度きりの招待コードをURLに持たせる。配布先を事前確認し、誤送信時は失効できるようにする。
3. ドライバーはLINE LIFF内でリンクを開く。LINE SDKからID tokenを取得し、Edge FunctionがLINE APIで署名・aud・iss・exp・subを検証する。
4. サーバー側の単一トランザクションで招待の未使用・期限内、DriverIDの未紐付け、LINE userIdの未紐付けを検証し、リンクを保存して招待を消費する。競合は失敗させる。
5. 2回目以降はLINE ID tokenで本人のDriverIDのみ取得。RLSを維持し、他のDriverIDの申込・車両・書類を返さない。
6. デモで正常・期限切れ・二重使用・別LINE・別DriverID・誤送信失効・同時利用・不正トークンをテスト後に本番移行を検討。

## 注意
招待リンクは所持者が使えるため、氏名だけの台帳から無差別に送信しない。配布先が本人のものと確認できない既存ドライバーは、GOLD FIRSTからの個別連絡等で本人の受取先を確かめてから発行する。
