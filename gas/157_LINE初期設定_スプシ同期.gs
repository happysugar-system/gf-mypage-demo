/** GOLD FIRST / 157_LINE初期設定_スプシ同期.gs
 * 既存GASプロジェクトに追加。既存130〜156は変更しない。
 * Script Properties: GF_LINE_PROFILE_SYNC_TOKEN (157専用の秘密トークン（既存の連絡先同期と別）)
 * 本番スプレッドシート: GOLD FIRST 車両・ドライバー管理
 * 手動で GF157_初期設定を同期() をテストし、既存の定期実行関数に1行追加する。
 */
function GF157_初期設定を同期() {
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) return {skipped:'locked'};
  try {
    const token=PropertiesService.getScriptProperties().getProperty('GF_LINE_PROFILE_SYNC_TOKEN');
    if(!token || token.length<32) throw new Error('GF_LINE_PROFILE_SYNC_TOKEN 未設定');
    const root='https://tgxrnrqxafytyqfwwsag.supabase.co/functions/v1/';
    const queue=UrlFetchApp.fetch(root+'gf-line-profile-sync-queue',{
      method:'get',headers:{'x-gf-sync-token':token},muteHttpExceptions:true
    });
    if(queue.getResponseCode()!==200)throw new Error('queue HTTP '+queue.getResponseCode());
    const items=JSON.parse(queue.getContentText()).requests||[];
    const book=SpreadsheetApp.openById('17IzIUJeYQw3nO8GZsUSCgLfHVECNINZNkQdg38GW57o');
    const sheet=book.getSheetByName('ドライバーマスター');
    if(!sheet)throw new Error('ドライバーマスターがありません');
    const values=sheet.getDataRange().getValues(),headers=values[0].map(String);
    const cols=['DriverID','紹介元','所属会社名','緊急連絡先氏名','緊急連絡先電話番号'];
    const idx=Object.fromEntries(cols.map(x=>[x,headers.indexOf(x)]));
    if(cols.some(x=>idx[x]<0))throw new Error('必要な列がありません');
    const rows=new Map();
    for(let i=1;i<values.length;i++){
      const id=String(values[i][idx.DriverID]||'').trim();
      if(!id)continue;
      if(rows.has(id))throw new Error('DriverID重複: '+id);
      rows.set(id,i+1);
    }
    const mapping=[['referral_source','紹介元'],['company_name','所属会社名'],
      ['emergency_contact_name','緊急連絡先氏名'],['emergency_contact_phone','緊急連絡先電話番号']];
    let updated=0,missing=0;
    for(const item of items){
      const row=rows.get(item.driver_id);
      if(!row){missing++;console.warn('未一致DriverID: '+item.driver_id);continue;}
      // 空欄で既存の台帳データを消さない。「なし」は明示値として書き込む
      for(const [field,column] of mapping){
        const val=String(item[field]??'').trim();
        if(!val)continue;
        if(String(values[row-1][idx[column]]??'').trim()!==val){
          const cell=sheet.getRange(row,idx[column]+1);
          if(column==='緊急連絡先電話番号') cell.setNumberFormat('@');
          cell.setValue(val);
        }
      }
      SpreadsheetApp.flush();
      const ack=UrlFetchApp.fetch(root+'gf-line-profile-sync-ack',{
        method:'post',contentType:'application/json',
        headers:{'x-gf-sync-token':token},
        payload:JSON.stringify({driver_id:item.driver_id,updated_at:item.updated_at,result:'applied'}),
        muteHttpExceptions:true
      });
      if(ack.getResponseCode()!==200)throw new Error('ack HTTP '+ack.getResponseCode()+' / '+item.driver_id);
      updated++;
    }
    console.log(JSON.stringify({updated,missing,queued:items.length}));
    return {updated,missing,queued:items.length};
  }finally{lock.releaseLock();}
}

/**
 * Supabase Edge Function Secretsに登録したトークンをGASへ設定する。
 * 1. Supabaseで GF_LINE_PROFILE_SYNC_TOKEN を作成（64文字以上のランダム文字列）
 * 2. 下の PASTE_TOKEN_HERE にその値を一時的に貼り付ける
 * 3. GF157_同期トークン初期設定() を実行する
 * 4. 成功後、コード中の値を PASTE_TOKEN_HERE に戻して保存する
 * ※トークンをログやチャットに表示しない。既存トークンを上書きしない。
 */
function GF157_同期トークン初期設定() {
  const token='PASTE_TOKEN_HERE';
  if(token==='PASTE_TOKEN_HERE'||token.length<32)throw new Error('Supabaseで発行したトークンをコードに一時貼り付けしてください');
  const props=PropertiesService.getScriptProperties();
  const key='GF_LINE_PROFILE_SYNC_TOKEN';
  if(props.getProperty(key))throw new Error('すでに設定済み。上書きしません');
  props.setProperty(key,token);
  console.log('GF157 専用同期トークンを保存しました（値は非表示）');
}
