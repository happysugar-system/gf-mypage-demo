/**
 * GOLD FIRST / 158_管理者変更差分確認.gs
 * スプシ正本 → Supabase 反映前の安全な差分確認。
 * 読取専用。既存トリガー・157・156・130〜134は変更しない。
 * 対象は初回プロフィール関連の6項目。DriverIDで照合する。
 * 本番書込は実装していない（API・競合対策を検証後に追加）。
 */
const GF158_CONFIG={
 SPREADSHEET_ID:'17IzIUJeYQw3nO8GZsUSCgLfHVECNINZNkQdg38GW57o',
 SHEET_NAME:'ドライバーマスター',
 API:'https://tgxrnrqxafytyqfwwsag.supabase.co/functions/v1/gf-line-profile-sync-queue',
 MAX_REQUESTS:20
};
function GF158_管理者差分プレビュー(){
 const sh=SpreadsheetApp.openById(GF158_CONFIG.SPREADSHEET_ID).getSheetByName(GF158_CONFIG.SHEET_NAME);
 if(!sh)throw Error('ドライバーマスターが見つかりません');
 const header=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
 const mapping={phone_number:'電話番号',email:'契約者メールアドレス',referral_source:'紹介元',company_name:'所属会社名',emergency_contact_name:'緊急連絡先氏名',emergency_contact_phone:'緊急連絡先電話番号'};
 const cols={};
 for(const name of ['DriverID',...Object.values(mapping)]){
  const matches=header.map((v,i)=>v===name?i+1:0).filter(Boolean);
  if(matches.length!==1)throw Error('列名の重複または欠落: '+name);
  cols[name]=matches[0];
 }
 const props=PropertiesService.getScriptProperties();
 const token=props.getProperty('GF_CONTACT_READ_API_TOKEN')||props.getProperty('GF190_SHARED_SECRET');
 if(!token||token.length<32)throw Error('同期トークン未設定');
 const res=UrlFetchApp.fetch(GF158_CONFIG.API,{method:'get',headers:{'x-gf-sync-token':token},muteHttpExceptions:true});
 if(res.getResponseCode()!==200)throw Error('API HTTP '+res.getResponseCode());
 const body=JSON.parse(res.getContentText());
 if(body.status!=='ok'||!Array.isArray(body.requests)||body.requests.length>GF158_CONFIG.MAX_REQUESTS)throw Error('API応答不正');
 const last=sh.getLastRow();
 const rows=last>1?sh.getRange(2,1,last-1,sh.getLastColumn()).getDisplayValues():[];
 const index=new Map();
 rows.forEach((r,i)=>{const id=String(r[cols.DriverID-1]||'').trim();if(id){if(index.has(id))index.set(id,-1);else index.set(id,i);}});
 const differences=[];
 for(const item of body.requests){
  const i=index.get(String(item.driver_id||''));
  if(i===undefined||i===-1){differences.push({driver_id:item.driver_id,error:'DriverID不明または重複'});continue;}
  for(const [field,col] of Object.entries(mapping)){
   const sheet=String(rows[i][cols[col]-1]||'').trim();
   const remote=String(item[field]??'').trim();
   if(sheet!==remote)differences.push({driver_id:item.driver_id,column:col,sheet_value:sheet,supabase_value:remote});
  }
 }
 console.log('GF158 差分確認（未同期キュー対象のみ） '+JSON.stringify({checked:body.requests.length,differences:differences.length,write:false}));
 differences.forEach(d=>console.log(JSON.stringify(d)));
 return {checked:body.requests.length,differences,write:false,note:'未同期キューのみ。全ドライバーの差分検査や書込は未対応'};
}
