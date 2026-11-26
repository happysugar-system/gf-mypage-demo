// Additive helper for GF_SB_v4受付計画_. No triggers or writes.
function GF_SB_申込詳細新規項目_(heads, row) {
  const result = {};
  for (const [header,key] of [['稼働エリア','application_area'],['契約者メールアドレス','application_email']]) {
    const matches = heads.map((h,i)=>String(h).trim()===header?i:-1).filter(i=>i>=0);
    if(matches.length!==1) throw Error('受付見出し不足・重複: '+header);
    result[key]=String(row[matches[0]]??'').trim()||null;
  }
  return result;
}
// In existing GF_SB_v4受付計画_ records.push({...}) add:
// ...GF_SB_申込詳細新規項目_(heads,r)
// Keep existing receipt/driver validation, write guards and trigger unchanged.
