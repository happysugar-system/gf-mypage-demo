/**
 * GOLD FIRST / 161_管理者変更1件同期.gs
 * 手動テスト専用。159基準との差分から1件だけ同期する。
 * 安全装置: GAS側の明示許可 + Supabase側の書込許可の両方が必要。
 * 既存トリガー・156/157・車両ワーカーは変更しない。
 */
function GF161_本番1件同期テスト(){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(5000))throw Error('他の処理が実行中');
 try{
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('GF161_SINGLE_WRITE_ENABLED')!=='true')throw Error('書込停止中: GF161_SINGLE_WRITE_ENABLED=true が必要');
  if(!props.getProperty(GF159_PREFIX+'INITIALIZED'))throw Error('159基準が未登録');
  const token=props.getProperty('GF_CONTACT_READ_API_TOKEN')||props.getProperty('GF190_SHARED_SECRET');
  if(!token||token.length<32)throw Error('同期トークン未設定');
  const sh=SpreadsheetApp.openById(GF158_CONFIG.SPREADSHEET_ID).getSheetByName(GF158_CONFIG.SHEET_NAME);
  const head=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
  const cols={};
  for(const name of ['DriverID',...Object.keys(GF160_FIELDS)]){
   const found=head.map((x,i)=>x===name?i:-1).filter(i=>i>=0);
   if(found.length!==1)throw Error('列名不正: '+name);
   cols[name]=found[0];
  }
  const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getDisplayValues():[];
  const index=new Map(),duplicates=new Set();
  rows.forEach((r,i)=>{const id=String(r[cols.DriverID]||'').trim();if(!id)return;if(index.has(id))duplicates.add(id);index.set(id,i);});
  const candidates=[];
  for(const [id,i] of index){
   if(!/^D[0-9]{6}$/.test(id)||id==='D999999'||duplicates.has(id))continue;
   const raw=props.getProperty(GF159_PREFIX+id);if(!raw)continue;
   const base=JSON.parse(raw);
   for(const [col,field] of Object.entries(GF160_FIELDS)){
    const desired=String(rows[i][cols[col]]??'').trim();
    if(GF159_ハッシュ_(desired)===base[col])continue;
    if(!desired||desired.length>250)continue;
    candidates.push({id,col,field,desired});
   }
  }
  if(candidates.length!==1)throw Error('安全停止: 更新候補が'+candidates.length+'件です。1件だけにしてください');
  const item=candidates[0];
  // 現在のSupabase値を取得（対象IDが1件かつ既存プロフィールがあること）。
  let record=null;
  for(let page=0;page<GF158_CONFIG.MAX_PAGES;page++){
   const r=UrlFetchApp.fetch(GF158_CONFIG.API+'?page='+page,{headers:{'x-gf-sync-token':token},muteHttpExceptions:true});
   if(r.getResponseCode()!==200)throw Error('取得API HTTP '+r.getResponseCode());
   const b=JSON.parse(r.getContentText());
   if(b.status!=='ok'||!Array.isArray(b.records)||b.page!==page)throw Error('取得API不正');
   const match=b.records.filter(x=>x.driver_id===item.id);
   if(match.length>1)throw Error('DriverID重複');
   if(match.length===1)record=match[0];
   if(!b.has_more)break;
  }
  if(!record||!record.profile_exists)throw Error('Supabaseプロフィール未登録');
  const expected=String(record[item.field]??'');
  if(expected===item.desired)throw Error('Supabaseは既に同じ値です。手動確認が必要');
  const r=UrlFetchApp.fetch(GF160_API,{method:'post',contentType:'application/json',headers:{'x-gf-sync-token':token},payload:JSON.stringify({driver_id:item.id,field:item.field,expected,desired:item.desired,dry_run:false}),muteHttpExceptions:true});
  let body={};try{body=JSON.parse(r.getContentText())}catch(_){}
  if(r.getResponseCode()!==200||body.status!=='updated')throw Error('更新失敗 HTTP '+r.getResponseCode()+' '+String(body.reason||body.error||body.status||''));
  // 更新後、現在のスプシ値が変わっていない場合に限り、成功した項目の基準ハッシュを更新。
  const now=String(sh.getRange(index.get(item.id)+2,cols[item.col]+1).getDisplayValue()??'').trim();
  if(now===item.desired){
   const key=GF159_PREFIX+item.id,base=JSON.parse(props.getProperty(key));
   base[item.col]=GF159_ハッシュ_(item.desired);props.setProperty(key,JSON.stringify(base));
  }else console.log('GF161 注意: 同期中にスプシ値が変更されたため基準未更新');
  console.log('GF161 更新成功 '+JSON.stringify({driver_id:item.id,column:item.col,write:true}));
  return {driver_id:item.id,column:item.col,updated:true};
 }finally{
  PropertiesService.getScriptProperties().deleteProperty('GF161_SINGLE_WRITE_ENABLED');
  lock.releaseLock();
 }
}
