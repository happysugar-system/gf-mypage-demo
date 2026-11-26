// Replacement of GF_SB_v4受付計画_ only, based on archived Nov 12 source.
// Preserve the existing active project configuration and all other functions.
function GF_SB_v4受付計画_(){
  const sh=GF_SB_受付ブック_().getSheetByName(GF_SB_V4.RECEPTION_SHEET);
  if(!sh)throw Error('車両依頼受付シートなし');
  const grid=sh.getDataRange().getDisplayValues(),heads=grid[0].map(x=>String(x).trim());
  const required=['受付番号','確認DriverID','受付日時','受付状態','契約状況','契約更新日時','納車希望','稼働開始希望','稼働エリア','契約者メールアドレス'];
  required.forEach(h=>{if(heads.filter(x=>x===h).length!==1)throw Error('受付見出し不正: '+h)});
  const col=Object.fromEntries(heads.map((h,i)=>[h,i]));const seen=new Set(),records=[];let pending=0;
  for(let i=1;i<grid.length;i++){
    const r=grid[i],receipt=String(r[col['受付番号']]||'').trim();if(!receipt)continue;
    if(receipt.startsWith('TEST-'))continue;
    if(seen.has(receipt))throw Error('受付番号重複 行'+(i+1));seen.add(receipt);
    const val=h=>String(r[col[h]]||'').trim()||null,driver=val('確認DriverID');
    if(!driver){pending++;continue;}
    records.push({receipt_id:receipt,driver_id:driver,received_at:val('受付日時'),reception_status:val('受付状態'),contract_status:val('契約状況'),contract_updated_at:val('契約更新日時'),delivery_wish:val('納車希望'),start_wish:val('稼働開始希望'),application_area:val('稼働エリア'),application_email:val('契約者メールアドレス')});
  }
  const existing=GF_SB_v4全件_(GF_SB_V4.APPLICATION_TABLE,'receipt_id');
  const ids=new Set(existing.map(x=>String(x.receipt_id)));
  return {newRecords:records.filter(x=>!ids.has(x.receipt_id)),pending,eligible:records.length,existing:existing.length};
}
