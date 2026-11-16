/**
 * GOLD FIRST / 158_管理者変更差分確認.gs
 * スプシ正本とSupabase全ドライバーの差分を読み取り専用で確認する。
 * 初回の差分は既存データの不一致であり「管理者による変更」とは断定しない。
 * 既存の130〜134・156・157およびトリガーは変更しない。
 */
const GF158_CONFIG={
 SPREADSHEET_ID:'17IzIUJeYQw3nO8GZsUSCgLfHVECNINZNkQdg38GW57o',
 SHEET_NAME:'ドライバーマスター',
 API:'https://tgxrnrqxafytyqfwwsag.supabase.co/functions/v1/gf-admin-driver-profile-snapshot',
 MAX_PAGES:10
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
 const records=[],seenRemote=new Set();
 let complete=false;
 for(let page=0;page<GF158_CONFIG.MAX_PAGES;page++){
  const res=UrlFetchApp.fetch(GF158_CONFIG.API+'?page='+page,{method:'get',headers:{'x-gf-sync-token':token},muteHttpExceptions:true});
  if(res.getResponseCode()!==200)throw Error('API HTTP '+res.getResponseCode());
  const body=JSON.parse(res.getContentText());
  if(body.status!=='ok'||body.page!==page||!Array.isArray(body.records)||body.records.length>200||typeof body.has_more!=='boolean')throw Error('API応答不正');
  for(const record of body.records){
   if(!/^D[0-9]{6,7}$/.test(String(record.driver_id||'')))throw Error('Supabase DriverID形式不正: '+String(record.driver_id||''));
   if(seenRemote.has(record.driver_id))throw Error('Supabase DriverID重複: '+record.driver_id);
   seenRemote.add(record.driver_id);records.push(record);
  }
  if(!body.has_more){complete=true;break;}
 }
 if(!complete)throw Error('ページ上限超過: 全件取得できません');
 const last=sh.getLastRow();
 const rows=last>1?sh.getRange(2,1,last-1,sh.getLastColumn()).getDisplayValues():[];
 const index=new Map();
 rows.forEach((r,i)=>{
  const id=String(r[cols.DriverID-1]||'').trim();
  if(id){if(index.has(id))index.set(id,-1);else index.set(id,i);}
 });
 const differences=[],issues=[];
 for(const item of records){
  const i=index.get(item.driver_id);
  if(i===undefined||i===-1){issues.push({driver_id:item.driver_id,reason:'スプシ側DriverID不明または重複'});continue;}
  for(const [field,col] of Object.entries(mapping)){
   // プロフィール未登録者については設定4項目の差分を判定しない。
   if(!item.profile_exists&&!['phone_number','email'].includes(field))continue;
   const sheet=String(rows[i][cols[col]-1]??'').trim();
   const remote=String(item[field]??'').trim();
   if(sheet!==remote)differences.push({driver_id:item.driver_id,column:col,sheet_value:sheet,supabase_value:remote});
  }
 }
 for(const [id,i] of index){
  if(i===-1)issues.push({driver_id:id,reason:'スプシ側DriverID重複'});
  else if(!seenRemote.has(id))issues.push({driver_id:id,reason:'Supabase側DriverID未登録'});
 }
 const summary={checked:records.length,sheet_rows:rows.length,differences:differences.length,issues:issues.length,write:false};
 console.log('GF158 全ドライバー差分プレビュー '+JSON.stringify(summary));
 // 個人情報をログに出さない。必要な差分の列名・IDのみ表示。
 differences.slice(0,30).forEach(d=>console.log('GF158 差分 '+d.driver_id+' '+d.column));
 issues.slice(0,30).forEach(d=>console.log('GF158 要確認 '+d.driver_id+' '+d.reason));
 if(differences.length>30||issues.length>30)console.log('GF158 ログ表示は各30件まで');
 return {summary,differences,issues,note:'読取専用。初回差分は変更履歴ではなく現時点の不一致。自動書込は未実装。'};
}
