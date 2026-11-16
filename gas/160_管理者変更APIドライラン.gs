/**
 * GOLD FIRST / 160_管理者変更APIドライラン.gs
 * 159の基準登録以降に変更されたセルを検出し、Supabase APIにdry_runで検証。
 * 既存GAS/トリガーは変更しない。Supabaseへの書込は一切しない。
 */
const GF160_API='https://tgxrnrqxafytyqfwwsag.supabase.co/functions/v1/gf-admin-driver-profile-patch';
const GF160_FIELDS={紹介元:'referral_source',所属会社名:'company_name',緊急連絡先氏名:'emergency_contact_name',緊急連絡先電話番号:'emergency_contact_phone'};
function GF160_変更APIドライラン(){
 const props=PropertiesService.getScriptProperties();
 if(!props.getProperty(GF159_PREFIX+'INITIALIZED'))throw Error('159番の基準が未登録');
 const token=props.getProperty('GF_CONTACT_READ_API_TOKEN')||props.getProperty('GF190_SHARED_SECRET');
 if(!token||token.length<32)throw Error('同期トークン未設定');
 const sh=SpreadsheetApp.openById(GF158_CONFIG.SPREADSHEET_ID).getSheetByName(GF158_CONFIG.SHEET_NAME);
 if(!sh)throw Error('ドライバーマスターがありません');
 const head=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
 const columns={};
 for(const key of ['DriverID',...GF159_FIELDS]){
  const hits=head.map((v,i)=>v===key?i:-1).filter(i=>i>=0);
  if(hits.length!==1)throw Error('列名重複または欠落: '+key);
  columns[key]=hits[0];
 }
 const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getDisplayValues():[];
 const seen=new Set(),duplicates=new Set(),byId=new Map();
 for(const row of rows){
  const id=String(row[columns.DriverID]||'').trim();
  if(!id)continue;
  if(seen.has(id))duplicates.add(id);
  seen.add(id);byId.set(id,row);
 }
 const remote=new Map();let complete=false;
 for(let page=0;page<GF158_CONFIG.MAX_PAGES;page++){
  const res=UrlFetchApp.fetch(GF158_CONFIG.API+'?page='+page,{method:'get',headers:{'x-gf-sync-token':token},muteHttpExceptions:true});
  if(res.getResponseCode()!==200)throw Error('スナップショットAPI HTTP '+res.getResponseCode());
  const body=JSON.parse(res.getContentText());
  if(body.status!=='ok'||body.page!==page||!Array.isArray(body.records)||typeof body.has_more!=='boolean'||body.records.length>200)throw Error('スナップショット応答不正');
  for(const rec of body.records){
   if(remote.has(rec.driver_id))throw Error('Supabase側DriverID重複');
   remote.set(rec.driver_id,rec);
  }
  if(!body.has_more){complete=true;break;}
 }
 if(!complete)throw Error('全件取得未完了');
 const stats={changed:0,eligible:0,preview_ok:0,conflict:0,skipped:0,write:false};
 const results=[];
 for(const [id,row] of byId){
  const baseline=props.getProperty(GF159_PREFIX+id);
  if(!baseline)continue;
  const base=JSON.parse(baseline);
  for(const col of GF159_FIELDS){
   const value=String(row[columns[col]]??'').trim();
   if(GF159_ハッシュ_(value)===base[col])continue;
   stats.changed++;
   const field=GF160_FIELDS[col];
   if(!field||duplicates.has(id)||!/^D[0-9]{6}$/.test(id)||id==='D999999'||!value||value.length>250||!remote.has(id)||!remote.get(id).profile_exists){
    stats.skipped++;results.push({driver_id:id,column:col,status:'skipped'});continue;
   }
   const expected=String(remote.get(id)[field]??'');
   // Supabase側と既に同値ならAPIを呼ばない。基準は更新しない。
   if(expected===value){stats.skipped++;results.push({driver_id:id,column:col,status:'already_equal'});continue;}
   stats.eligible++;
   const res=UrlFetchApp.fetch(GF160_API,{
    method:'post',contentType:'application/json',headers:{'x-gf-sync-token':token},
    payload:JSON.stringify({driver_id:id,field,expected,desired:value,dry_run:true}),muteHttpExceptions:true
   });
   let body={};try{body=JSON.parse(res.getContentText())}catch(_){}
   const ok=res.getResponseCode()===200&&body.status==='preview';
   if(ok)stats.preview_ok++;else stats.conflict++;
   results.push({driver_id:id,column:col,status:ok?'preview_ok':'conflict',http:res.getResponseCode(),reason:body.reason||body.error||null});
  }
 }
 console.log('GF160 管理者変更APIドライラン '+JSON.stringify(stats));
 results.slice(0,40).forEach(x=>console.log('GF160 '+JSON.stringify(x)));
 return {summary:stats,results,note:'読み取りとdry_runのみ。Supabase書込なし。159基準も変更しない。'};
}
