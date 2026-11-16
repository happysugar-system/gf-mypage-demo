/**
 * GOLD FIRST / 162_テスト復旧基準整合.gs
 * D000002 の所属会社名がスプシ・Supabaseとも元の値に戻った場合だけ
 * 159の「所属会社名」基準ハッシュを整合させる。Supabase書込なし。
 * 既存GAS・トリガーは変更しない。
 */
function GF162_テスト復旧基準整合(){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(5000))throw Error('他のGAS処理中');
 try{
  const id='D000002',col='所属会社名',field='company_name',original='UP’ｓ';
  const props=PropertiesService.getScriptProperties();
  const key=GF159_PREFIX+id;
  const saved=props.getProperty(key);
  if(!saved)throw Error('159番の基準がありません');
  const token=props.getProperty('GF_CONTACT_READ_API_TOKEN')||props.getProperty('GF190_SHARED_SECRET');
  if(!token||token.length<32)throw Error('同期トークン未設定');
  const sh=SpreadsheetApp.openById(GF158_CONFIG.SPREADSHEET_ID).getSheetByName(GF158_CONFIG.SHEET_NAME);
  if(!sh)throw Error('ドライバーマスターなし');
  const head=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
  const getCol=name=>{const hits=head.map((v,i)=>v===name?i+1:0).filter(Boolean);if(hits.length!==1)throw Error('列名不正 '+name);return hits[0];};
  const idCol=getCol('DriverID'),companyCol=getCol(col);
  const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getDisplayValues():[];
  const matches=rows.map((r,i)=>String(r[idCol-1]||'').trim()===id?i+2:0).filter(Boolean);
  if(matches.length!==1)throw Error('DriverID件数が不正');
  const row=matches[0],value=String(sh.getRange(row,companyCol).getDisplayValue()).trim();
  if(value!==original)throw Error('スプシが元の所属会社名に戻っていません。先に手動で戻してください');
  let remote=null,complete=false;
  for(let page=0;page<GF158_CONFIG.MAX_PAGES;page++){
   const r=UrlFetchApp.fetch(GF158_CONFIG.API+'?page='+page,{method:'get',headers:{'x-gf-sync-token':token},muteHttpExceptions:true});
   if(r.getResponseCode()!==200)throw Error('API HTTP '+r.getResponseCode());
   const b=JSON.parse(r.getContentText());
   if(b.status!=='ok'||b.page!==page||!Array.isArray(b.records)||typeof b.has_more!=='boolean')throw Error('API応答不正');
   const found=b.records.filter(x=>x.driver_id===id);
   if(found.length>1||remote&&found.length)throw Error('Supabase側DriverID重複');
   if(found.length)remote=found[0];
   if(!b.has_more){complete=true;break;}
  }
  if(!complete||!remote||!remote.profile_exists||String(remote[field]??'')!==original)throw Error('Supabaseが元の値に戻っていません');
  // pending LINE変更があれば更新を停止する。dry_runは更新を行わない。
  const check=UrlFetchApp.fetch(GF160_API,{method:'post',contentType:'application/json',headers:{'x-gf-sync-token':token},payload:JSON.stringify({driver_id:id,field,expected:original,desired:original,dry_run:true}),muteHttpExceptions:true});
  let body={};try{body=JSON.parse(check.getContentText())}catch(_){}
  if(check.getResponseCode()!==200||body.status!=='preview')throw Error('同期キュー等の検証で停止 HTTP '+check.getResponseCode()+' '+String(body.reason||body.error||''));
  if(String(sh.getRange(row,companyCol).getDisplayValue()).trim()!==original)throw Error('確認中にスプシが変更されました');
  const latest=props.getProperty(key);
  if(latest!==saved)throw Error('159基準が並行変更されました');
  const baseline=JSON.parse(latest);
  baseline[col]=GF159_ハッシュ_(original);
  props.setProperty(key,JSON.stringify(baseline));
  console.log('GF162 復旧整合完了 '+JSON.stringify({driver_id:id,column:col,sheet_equals_supabase:true,baseline_updated:true,write_to_supabase:false}));
  return {driver_id:id,column:col,baseline_updated:true,write_to_supabase:false};
 }finally{lock.releaseLock();}
}
