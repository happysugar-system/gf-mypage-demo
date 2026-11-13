/**
 * GOLD FIRST ドライバー連絡先同期・安全テスト
 * 既存GASに追加可能な独立ファイル。既存関数・トリガーは変更しない。
 * 既定は読取専用。個人情報をログ出力しない。
 */
const GF_CONTACT_SYNC = Object.freeze({
  SPREADSHEET_ID: '17IzIUJeYQw3nO8GZsUSCgLfHVECNINZNkQdg38GW57o',
  SHEET_NAME: 'ドライバーマスター',
  DRIVER_ID_HEADER: 'DriverID',
  PHONE_HEADER: '電話番号',
  EMAIL_HEADER: '契約者メールアドレス'
});

/** 見出しの一致・重複とシートの存在だけを確認。更新しない。 */
function GF_連絡先同期_構成診断() {
  const sheet = SpreadsheetApp.openById(GF_CONTACT_SYNC.SPREADSHEET_ID)
    .getSheetByName(GF_CONTACT_SYNC.SHEET_NAME);
  if (!sheet) throw new Error('対象シートが存在しません');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const required = [GF_CONTACT_SYNC.DRIVER_ID_HEADER, GF_CONTACT_SYNC.PHONE_HEADER, GF_CONTACT_SYNC.EMAIL_HEADER];
  for (const header of required) {
    if (headers.filter(h => h === header).length !== 1) throw new Error('見出しの欠落または重複: ' + header);
  }
  console.log('構成OK / データ行数: ' + Math.max(0, sheet.getLastRow() - 1));
}

/**
 * 事前確認済みの変更データのみを処理する同期部品。
 * @param {{driverId:string, phone?:string, email?:string}} change
 * @param {{dryRun?:boolean, expectedPhone?:string, expectedEmail?:string, verified?:boolean}} options
 * @returns {{status:string, driverId:string, changedFields:string[]}}
 * 
 * 実運用ではサーバー側で認証済みの変更のみを渡す。
 * verified=true は呼び出し元が厳密に確認した場合だけ。
 * 一般公開のWebアプリから直接呼び出さない。
 */
function GF_連絡先同期_適用(change, options) {
  options = options || {};
  const dryRun = options.dryRun !== false;
  if (!change || !/^D[0-9]{6}$/.test(String(change.driverId || ''))) throw new Error('DriverID形式不正');
  const fields = {};
  if (Object.prototype.hasOwnProperty.call(change, 'phone')) {
    const phone = String(change.phone || '').replace(/[\\sー－-]/g, '');
    if (!/^0[0-9]{9,10}$/.test(phone)) throw new Error('電話番号形式不正');
    fields[GF_CONTACT_SYNC.PHONE_HEADER] = phone;
  }
  if (Object.prototype.hasOwnProperty.call(change, 'email')) {
    const email = String(change.email || '').trim();
    if (email.length > 254 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) throw new Error('メール形式不正');
    fields[GF_CONTACT_SYNC.EMAIL_HEADER] = email;
  }
  if (!Object.keys(fields).length) throw new Error('変更対象なし');
  if (!dryRun && options.verified !== true) throw new Error('本人確認未完了のため更新禁止');
  if (!dryRun && !Object.prototype.hasOwnProperty.call(options, 'expectedPhone')) throw new Error('旧電話番号の照合値が必要');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('同期ロック取得失敗');
  try {
    const sheet = SpreadsheetApp.openById(GF_CONTACT_SYNC.SPREADSHEET_ID).getSheetByName(GF_CONTACT_SYNC.SHEET_NAME);
    if (!sheet) throw new Error('対象シートなし');
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const col = {};
    for (const name of [GF_CONTACT_SYNC.DRIVER_ID_HEADER, GF_CONTACT_SYNC.PHONE_HEADER, GF_CONTACT_SYNC.EMAIL_HEADER]) {
      const matches = headers.map((h,i)=>h===name?i+1:0).filter(Boolean);
      if (matches.length!==1) throw new Error('見出しが一意ではありません: '+name);
      col[name]=matches[0];
    }
    const last=sheet.getLastRow();
    if(last<2) throw new Error('データ行なし');
    const ids=sheet.getRange(2,col[GF_CONTACT_SYNC.DRIVER_ID_HEADER],last-1,1).getDisplayValues().flat();
    const matching=ids.map((id,i)=>id===change.driverId?i+2:0).filter(Boolean);
    if(matching.length!==1) throw new Error('DriverID不一致または重複');
    const row=matching[0];
    const oldPhone=sheet.getRange(row,col[GF_CONTACT_SYNC.PHONE_HEADER]).getDisplayValue().replace(/[\\sー－-]/g,'');
    const oldEmail=sheet.getRange(row,col[GF_CONTACT_SYNC.EMAIL_HEADER]).getDisplayValue().trim();
    if (!dryRun && oldPhone!==String(options.expectedPhone||'').replace(/[\\sー－-]/g,'')) throw new Error('旧電話番号が変更済みです');
    if (!dryRun && Object.prototype.hasOwnProperty.call(fields,GF_CONTACT_SYNC.EMAIL_HEADER) &&
      !Object.prototype.hasOwnProperty.call(options,'expectedEmail')) throw new Error('旧メール照合値が必要');
    if (!dryRun && Object.prototype.hasOwnProperty.call(options,'expectedEmail') &&
      oldEmail!==String(options.expectedEmail||'').trim()) throw new Error('旧メールが変更済みです');
    const changed=Object.keys(fields).filter(k=>fields[k]!== (k===GF_CONTACT_SYNC.PHONE_HEADER?oldPhone:oldEmail));
    if(!dryRun) for(const name of changed) {
      const cell=sheet.getRange(row,col[name]);
      cell.setNumberFormat('@');
      cell.setValue(fields[name]);
    }
    return {status:dryRun?'DRY_RUN':'UPDATED',driverId:change.driverId,changedFields:changed};
  } finally { lock.releaseLock(); }
}

/** 自動で実行しても書き込まない診断。 */
function GF_連絡先同期_読取専用テスト() {
  GF_連絡先同期_構成診断();
  console.log('読取専用診断完了。本番の連絡先は変更していません。');
}
