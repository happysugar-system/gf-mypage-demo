/**
 * GOLD FIRST / 157_初回プロフィール空欄補完.gs
 * 既存156・130〜134は変更しない。既存トリガーも変更しない。
 * 初期状態は読み取り専用。DriverID一致かつ既存セルが空欄のときのみ更新。
 */
const GF157_CONFIG={
 SPREADSHEET_ID:'17IzIUJeYQw3nO8GZsUSCgLfHVECNINZNkQdg38GW57o',
 SHEET_NAME:'ドライバーマスター',
 API:'https://tgxrnrqxafytyqfwwsag.supabase.co/functions/v1/gf-line-profile-sync-queue',
 MAX_REQUESTS:20
};
function GF157_プレビュー(){return GF157_同期_(false);}
function GF157_本番同期(){
 const enabled=PropertiesService.getScriptProperties().getProperty('GF157_INITIAL_PROFILE_WRITE_ENABLED')==='true';
 return GF157_同期_(enabled);
}
function GF157_同期_(write){
 const result={mode:write?'WRITE':'READ_ONLY',checked:0,eligible:0,updated:0,acknowledged:0,protected:0,planned:0,conflict:0};
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(5000))throw Error('他のGAS処理が実行中です');
 try{
  const ss=SpreadsheetApp.openById(GF157_CONFIG.SPREADSHEET_ID);
  if(ss.getId()!==GF157_CONFIG.SPREADSHEET_ID)throw Error('対象ブック不一致');
  const sh=ss.getSheetByName(GF157_CONFIG.SHEET_NAME);
  if(!sh)throw Error('ドライバーマスターがありません');
  const header=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
  const names=['DriverID','電話番号','契約者メールアドレス','紹介元','所属会社名','緊急連絡先氏名','緊急連絡先電話番号'];
  const cols={};
  names.forEach(n=>{const indices=header.map((v,i)=>v===n?i+1:0).filter(Boolean);if(indices.length!==1)throw Error('列名が不正: '+n);cols[n]=indices[0];});
  const last=sh.getLastRow(),ids=last>1?sh.getRange(2,cols.DriverID,last-1,1).getDisplayValues().flat():[];
  const response=GF157_API_('get');
  if(response.status!=='ok'||!Array.isArray(response.requests)||response.requests.length>GF157_CONFIG.MAX_REQUESTS)throw Error('API応答不正');
  const mapping={phone_number:'電話番号',email:'契約者メールアドレス',referral_source:'紹介元',company_name:'所属会社名',emergency_contact_name:'緊急連絡先氏名',emergency_contact_phone:'緊急連絡先電話番号'};
  const seen=new Set();
  for(const item of response.requests){
   result.checked++;
   try{
    const id=String(item.driver_id||'');
    if(!/^D[0-9]{6}$/.test(id)||seen.has(id))throw Error('DriverID不正・重複');
    seen.add(id);
    const matches=ids.map((v,i)=>v===id?i+2:0).filter(Boolean);
    if(matches.length!==1)throw Error('DriverID未登録・重複');
    const row=matches[0],changes=[];
    for(const [key,colName] of Object.entries(mapping)){
     const raw=item[key];if(raw===null||raw===undefined||String(raw).trim()==='')continue;
     const value=String(raw).trim();
     if(value.length>254||/^[=+\-@]/.test(value))throw Error('危険な入力: '+colName);
     if(key==='phone_number'||key==='emergency_contact_phone'){if(!/^0[0-9]{9,10}$/.test(value))throw Error('電話番号形式不正');}
     if(key==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Error('メール形式不正');
     const cell=sh.getRange(row,cols[colName]),existing=String(cell.getDisplayValue()||'').trim();
     if(existing){if(existing!==(key==='email'?value.toLowerCase():value)){result.protected++;console.log('GF157 既存値保護: '+id+' '+colName);}continue;}
     changes.push({cell,value});
    }
    result.eligible++;
    result.planned+=changes.length;
    if(!write){console.log('GF157 プレビュー '+id+' 空欄補完予定 '+changes.length+'件');continue;}
    // 同じDriverIDであることと、対象セルがまだ空欄であることを直前に再確認。
    if(String(sh.getRange(row,cols.DriverID).getDisplayValue()).trim()!==id)throw Error('書込直前DriverID不一致');
    for(const change of changes){
     if(String(change.cell.getDisplayValue()||'').trim())throw Error('書込直前に値が入力されました');
    }
    for(const change of changes){change.cell.setNumberFormat('@');change.cell.setValue(change.value);}
    SpreadsheetApp.flush();
    for(const change of changes){if(String(change.cell.getDisplayValue()).trim()!==change.value)throw Error('書込検証失敗');}
    result.updated+=changes.length;
    const ack=GF157_API_('post',{driver_id:id,updated_at:item.updated_at,result:'applied'});
    if(!['recorded','stale_or_already_recorded'].includes(ack.status))throw Error('完了通知失敗');
    result.acknowledged++;
   }catch(e){result.conflict++;console.error('GF157 '+String(e.message||e));break;}
  }
  console.log(JSON.stringify(result));return result;
 }finally{lock.releaseLock();}
}
function GF157_API_(method,payload){
 const props=PropertiesService.getScriptProperties();
 const token=props.getProperty('GF_CONTACT_READ_API_TOKEN')||props.getProperty('GF190_SHARED_SECRET');
 if(!token||token.length<32)throw Error('同期トークンが未設定');
 const options={method,headers:{'x-gf-sync-token':token},muteHttpExceptions:true};
 if(payload){options.contentType='application/json';options.payload=JSON.stringify(payload);}
 const response=UrlFetchApp.fetch(GF157_CONFIG.API,options);
 if(response.getResponseCode()!==200)throw Error('同期API HTTP '+response.getResponseCode());
 return JSON.parse(response.getContentText());
}
function GF157_本番書込を有効化(){
 PropertiesService.getScriptProperties().setProperty('GF157_INITIAL_PROFILE_WRITE_ENABLED','true');
}
function GF157_本番書込を停止(){
 PropertiesService.getScriptProperties().setProperty('GF157_INITIAL_PROFILE_WRITE_ENABLED','false');
}