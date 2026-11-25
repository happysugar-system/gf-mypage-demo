// Additive helper for existing GF_SB GAS project. No triggers or writes on installation.
function GF_SB_申込詳細差分計画_(grid, existing) {
  const names=['受付番号','確認DriverID','稼働エリア','契約者メールアドレス'];
  const heads=grid[0].map(x=>String(x).trim());
  const idx=names.map(n=>{if(heads.filter(h=>h===n).length!==1)throw Error('受付見出し不足・重複: '+n);return heads.indexOf(n);});
  const seen=new Set(), map=new Map(), changes=[];
  for(const r of existing){if(map.has(r.receipt_id))throw Error('DB受付番号重複');map.set(r.receipt_id,r);}
  for(const row of grid.slice(1)){
    const [id,driver,area,email]=idx.map(i=>String(row[i]??'').trim());
    if(!id||id.startsWith('TEST-'))continue;
    if(seen.has(id))throw Error('受付番号重複');seen.add(id);
    const old=map.get(id);
    if(!driver||!old||old.driver_id!==driver)continue;
    const patch={};
    if(area&&(old.application_area??'')!==area)patch.application_area=area;
    if(email&&(old.application_email??'')!==email)patch.application_email=email;
    if(Object.keys(patch).length)changes.push({id,driver,patch});
  }
  return changes;
}
function GF_SB_申込詳細同期プレビュー(){
  const sh=GF_SB_受付ブック_().getSheetByName(GF_SB_V4.RECEPTION_SHEET);
  const rows=GF_SB_v4全件_(GF_SB_V4.APPLICATION_TABLE,'receipt_id,driver_id,application_area,application_email');
  return {changes:GF_SB_申込詳細差分計画_(sh.getDataRange().getDisplayValues(),rows).length};
}
function GF_SB_申込詳細同期(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw Error('同期中');
  try{
    GF_SB_v4書込許可_();
    if(PropertiesService.getScriptProperties().getProperty('GF_SB_APPLICATION_DETAIL_ENABLE')!=='YES')throw Error('申込詳細同期未承認');
    const sh=GF_SB_受付ブック_().getSheetByName(GF_SB_V4.RECEPTION_SHEET);
    const rows=GF_SB_v4全件_(GF_SB_V4.APPLICATION_TABLE,'receipt_id,driver_id,application_area,application_email');
    const changes=GF_SB_申込詳細差分計画_(sh.getDataRange().getDisplayValues(),rows);
    let written=0;
    for(const c of changes.slice(0,50)){
      const q='?receipt_id=eq.'+encodeURIComponent(c.id)+'&driver_id=eq.'+encodeURIComponent(c.driver);
      GF_SB_v4API_(GF_SB_V4.APPLICATION_TABLE,q,'patch',c.patch,'return=minimal');written++;
    }
    const verified=GF_SB_v4全件_(GF_SB_V4.APPLICATION_TABLE,'receipt_id,driver_id,application_area,application_email');
    const remaining=GF_SB_申込詳細差分計画_(sh.getDataRange().getDisplayValues(),verified).length;
    return {requested:written,remaining,complete:remaining===0};
  }finally{lock.releaseLock();}
}