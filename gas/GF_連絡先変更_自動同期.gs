/**
 * GOLD FIRST / 自動承認済み連絡先のスプシ同期
 * スタンドアロンGAS専用。既存130〜134.gsを変更しない。
 * Script Properties: GF_CONTACT_READ_API_TOKEN
 * 安全初期値: GF_CONTACT_SYNC_ENABLED=true になるまで書き込みしない。
 * トリガー: GF_連絡先変更_自動同期 を5分おきに設定（本番検証後）。
 */
const GF_AUTO_CONTACT = Object.freeze({
  spreadsheetId:'17IzIUJeYQw3nO8GZsUSCgLfHVECNINZNkQdg38GW57o',
  tab:'ドライバーマスター',
  queue:'https://tgxrnrqxafytyqfwwsag.supabase.co/functions/v1/gf-contact-sync-queue',
  ack:'https://tgxrnrqxafytyqfwwsag.supabase.co/functions/v1/gf-contact-sync-ack'
});
function GF_連絡先変更_自動同期(){
  const p=PropertiesService.getScriptProperties();
  if(p.getProperty('GF_CONTACT_SYNC_ENABLED')!=='true'){
    console.log('同期無効: GF_CONTACT_SYNC_ENABLED=true に設定すると開始');
    return {status:'DISABLED'};
  }
  const token=p.getProperty('GF_CONTACT_READ_API_TOKEN');
  if(!token||token.length<32)throw new Error('同期トークンが未設定または短すぎます');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))return {status:'LOCKED'};
  try{
    const sheet=SpreadsheetApp.openById(GF_AUTO_CONTACT.spreadsheetId).getSheetByName(GF_AUTO_CONTACT.tab);
    if(!sheet)throw new Error('ドライバーマスターがありません');
    const heads=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
    const col={};
    for(const h of ['DriverID','電話番号','契約者メールアドレス']){
      const indices=heads.map((v,i)=>v===h?i+1:0).filter(Boolean);
      if(indices.length!==1)throw new Error('列名が不正または重複: '+h);
      col[h]=indices[0];
    }
    const response=GF_連絡先変更_HTTP_(GF_AUTO_CONTACT.queue,'get',token);
    if(response.status!=='ok'||!Array.isArray(response.requests))throw new Error('キュー形式不正');
    if(response.requests.length>25)throw new Error('キュー上限超過');
    const last=sheet.getLastRow();
    if(last<2&&response.requests.length)throw new Error('台帳にデータがありません');
    const ids=last<2?[]:sheet.getRange(2,col.DriverID,last-1,1).getDisplayValues().flat();
    const seen=new Set();let updated=0,failed=0;
    for(const req of response.requests){
      try{
        if(!req||typeof req.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(req.id)||seen.has(req.id))
          throw new Error('申請ID不正');
        seen.add(req.id);
        if(!/^D[0-9]{6}$/.test(String(req.driver_id||'')))throw new Error('DriverID形式不正');
        const rows=ids.map((id,i)=>id===req.driver_id?i+2:0).filter(Boolean);
        if(rows.length!==1)throw new Error('DriverID未登録または重複');
        const updates=[];
        if(req.requested_phone!=null){
          const phone=String(req.requested_phone);
          if(!/^0[0-9]{9,10}$/.test(phone))throw new Error('電話番号形式不正');
          updates.push(['電話番号',phone]);
        }
        if(req.requested_email!=null){
          const email=String(req.requested_email);
          if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/^[=+\-@]/.test(email))
            throw new Error('メール形式不正');
          updates.push(['契約者メールアドレス',email]);
        }
        if(!updates.length)throw new Error('変更項目なし');
        const row=rows[0];
        for(const [header,value] of updates){
          const cell=sheet.getRange(row,col[header]);
          if(cell.getDisplayValue()!==value){
            cell.setNumberFormat('@');
            cell.setValue(value);
          }
        }
        SpreadsheetApp.flush();
        const ack=GF_連絡先変更_HTTP_(GF_AUTO_CONTACT.ack,'post',token,{id:req.id,result:'applied'});
        if(!['recorded','already_recorded'].includes(ack.status))throw new Error('完了記録失敗');
        updated++;
      }catch(e){
        failed++;
        console.error('連絡先同期失敗: 申請ID='+String(req&&req.id||'unknown')+' / '+String(e.message||e));
      }
    }
    console.log(JSON.stringify({fetched:response.requests.length,completed:updated,failed}));
    return {fetched:response.requests.length,completed:updated,failed};
  }finally{lock.releaseLock();}
}
function GF_連絡先変更_HTTP_(url,method,token,payload){
  const options={method,headers:{'x-gf-sync-token':token},muteHttpExceptions:true};
  if(payload){options.contentType='application/json';options.payload=JSON.stringify(payload);}
  const res=UrlFetchApp.fetch(url,options);
  if(res.getResponseCode()!==200)throw new Error('同期API HTTP '+res.getResponseCode());
  return JSON.parse(res.getContentText());
}
