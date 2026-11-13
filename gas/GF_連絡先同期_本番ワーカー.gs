/**
 * GOLD FIRST / 連絡先変更同期 本番用ワーカー候補
 * スタンドアロンGAS。既存130〜134.gsには依存しない。
 *
 * 安全上、現時点では「検証済み申請を返すAPI」が未実装のため
 * 実行しても台帳は更新しない（fail closed）。
 * APIが整うまで、テスト用トークンを設定しても本番同期は開始されない。
 */
const GF_CONTACT_SYNC = Object.freeze({
  spreadsheetId: '17IzIUJeYQw3nO8GZsUSCgLfHVECNINZNkQdg38GW57o',
  sheetName: 'ドライバーマスター',
  requiredHeaders: ['DriverID','電話番号','契約者メールアドレス'],
  apiUrlProperty: 'GF_CONTACT_VERIFIED_QUEUE_URL',
  tokenProperty: 'GF_CONTACT_VERIFIED_QUEUE_TOKEN',
  enableProperty: 'GF_CONTACT_SYNC_ENABLED',
  dryRunProperty: 'GF_CONTACT_SYNC_DRY_RUN'
});

/** 設定とシート構造だけを検査する。個人情報はログに出さない。 */
function GF_連絡先同期_本番準備診断() {
  const p = PropertiesService.getScriptProperties();
  const sheet = SpreadsheetApp.openById(GF_CONTACT_SYNC.spreadsheetId)
    .getSheetByName(GF_CONTACT_SYNC.sheetName);
  if (!sheet) throw new Error('ドライバーマスターが見つかりません');
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
  for (const name of GF_CONTACT_SYNC.requiredHeaders) {
    if (headers.filter(x => x === name).length !== 1) {
      throw new Error('列名が未定義または重複: ' + name);
    }
  }
  const configured = !!p.getProperty(GF_CONTACT_SYNC.apiUrlProperty)
    && !!p.getProperty(GF_CONTACT_SYNC.tokenProperty);
  const enabled = p.getProperty(GF_CONTACT_SYNC.enableProperty) === 'true';
  const dryRun = p.getProperty(GF_CONTACT_SYNC.dryRunProperty) !== 'false';
  console.log(JSON.stringify({ sheetReady: true, apiConfigured: configured,
    enabled, dryRun, driverRows: Math.max(0,sheet.getLastRow()-1) }));
  return { sheetReady: true, apiConfigured: configured, enabled, dryRun };
}

/**
 * 本番用エントリポイント。検証済み申請キューのサーバー側仕様と
 * 結果確定APIが完成するまで同期を許可しない。
 * 既存のgf-contact-read-onlyは件数のみ返すので、ここには接続しない。
 */
function GF_連絡先同期_本番実行() {
  GF_連絡先同期_本番準備診断();
  throw new Error(
    '安全停止: 本人確認済み申請キュー・処理結果確定API・冪等化が未実装のため同期しません'
  );
}
