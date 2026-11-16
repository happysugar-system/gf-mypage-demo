/**
 * GOLD FIRST / 159_管理者編集追跡_準備.gs
 * 158番の全件比較が正常に動いた後の基準スナップショット。
 * 読み取り専用・本番書き込みなし・トリガー追加なし。
 * スクリプトプロパティに各セルのSHA-256のみ保存（個人情報の生値は保存しない）。
 * 159の基準は、手動で実行した時点のスプシ値。初回不一致を自動同期しない。
 */
const GF159_PREFIX='GF159_BASE_V1_';
const GF159_FIELDS=['電話番号','契約者メールアドレス','紹介元','所属会社名','緊急連絡先氏名','緊急連絡先電話番号'];
function GF159_ハッシュ_(v){
 const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(v??'').trim(),Utilities.Charset.UTF_8);
 return Utilities.base64EncodeWebSafe(bytes);
}
function GF159_行取得_(){
 const sh=SpreadsheetApp.openById(GF158_CONFIG.SPREADSHEET_ID).getSheetByName(GF158_CONFIG.SHEET_NAME);
 if(!sh)throw Error('対象シートがありません');
 const head=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0],cols={};
 for(const name of ['DriverID',...GF159_FIELDS]){
  const hits=head.map((v,i)=>v===name?i: -1).filter(i=>i>=0);
  if(hits.length!==1)throw Error('列名不正: '+name);
  cols[name]=hits[0];
 }
 const data=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getDisplayValues():[];
 const ids=new Map();
 for(const row of data){
  const id=String(row[cols.DriverID]||'').trim();
  if(!id)continue;
  if(ids.has(id)){ids.set(id,null);continue;}
  ids.set(id,Object.fromEntries(GF159_FIELDS.map(n=>[n,GF159_ハッシュ_(row[cols[n]])])));
 }
 return ids;
}
function GF159_基準を初回登録(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(5000))throw Error('他のGAS処理中');
 try{
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty(GF159_PREFIX+'INITIALIZED'))throw Error('基準登録済み。上書きは禁止');
  const preview=GF158_管理者差分プレビュー();
  if(preview.summary.issues>0)console.log('GF159 注意: DriverID要確認 '+preview.summary.issues+'件は対象外');
  const ids=GF159_行取得_(),allowed=new Set();
  // 158番でSupabase側と照合できたDriverIDだけを対象にする。
  // 差分・問題のないIDも含むので、158番APIを同じトークンで取得し直す。
  const token=props.getProperty('GF_CONTACT_READ_API_TOKEN')||props.getProperty('GF190_SHARED_SECRET');
  let complete=false;
  for(let page=0;page<GF158_CONFIG.MAX_PAGES;page++){
   const r=UrlFetchApp.fetch(GF158_CONFIG.API+'?page='+page,{headers:{'x-gf-sync-token':token},muteHttpExceptions:true});
   if(r.getResponseCode()!==200)throw Error('API HTTP '+r.getResponseCode());
   const b=JSON.parse(r.getContentText());
   if(b.status!=='ok'||b.page!==page||!Array.isArray(b.records))throw Error('API不正');
   b.records.forEach(x=>allowed.add(x.driver_id));
   if(!b.has_more){complete=true;break;}
  }
  if(!complete)throw Error('全件取得失敗');
  const entries={};let count=0;
  for(const [id,hashes] of ids){
   if(!hashes||!allowed.has(id)||!/^D[0-9]{6}$/.test(id)||id==='D999999')continue;
   entries[GF159_PREFIX+id]=JSON.stringify(hashes);count++;
  }
  // 最後に初期化フラグを書き、部分失敗時は再実行可能。
  props.setProperties(entries,false);
  props.setProperty(GF159_PREFIX+'INITIALIZED',new Date().toISOString());
  console.log('GF159 基準登録 '+JSON.stringify({registered:count,excluded:ids.size-count,write_to_supabase:false}));
  return {registered:count,excluded:ids.size-count,write_to_supabase:false};
 }finally{lock.releaseLock();}
}
function GF159_管理者変更プレビュー(){
 const props=PropertiesService.getScriptProperties();
 if(!props.getProperty(GF159_PREFIX+'INITIALIZED'))throw Error('先にGF159_基準を初回登録を実行');
 const ids=GF159_行取得_(),changed=[],untracked=[];
 for(const [id,hashes] of ids){
  const saved=props.getProperty(GF159_PREFIX+id);
  if(!saved){untracked.push(id);continue;}
  if(!hashes){untracked.push(id);continue;}
  const base=JSON.parse(saved);
  for(const field of GF159_FIELDS)if(hashes[field]!==base[field])changed.push({driver_id:id,column:field});
 }
 console.log('GF159 管理者変更プレビュー '+JSON.stringify({changed:changed.length,untracked:untracked.length,write:false}));
 changed.slice(0,30).forEach(x=>console.log('GF159 変更 '+x.driver_id+' '+x.column));
 return {changed,untracked,write:false};
}
