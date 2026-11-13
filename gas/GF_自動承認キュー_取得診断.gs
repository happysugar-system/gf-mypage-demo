/**
 * GOLD FIRST: 自動承認済み連絡先変更キューを取得する。
 * 既存GASに依存しない。APIの申請明細を読み、件数だけ記録。
 * 台帳の書き換えは行わない。
 */
function GF_自動承認キュー_取得診断() {
  const props=PropertiesService.getScriptProperties();
  const token=props.getProperty('GF_CONTACT_READ_API_TOKEN');
  if(!token)throw new Error('GF_CONTACT_READ_API_TOKENが未設定');
  const url='https://tgxrnrqxafytyqfwwsag.supabase.co/functions/v1/gf-contact-sync-queue';
  const response=UrlFetchApp.fetch(url,{
    method:'get',muteHttpExceptions:true,
    headers:{'x-gf-sync-token':token}
  });
  if(response.getResponseCode()!==200)
    throw new Error('キュー取得失敗 HTTP '+response.getResponseCode());
  const payload=JSON.parse(response.getContentText());
  if(payload.status!=='ok'||!Array.isArray(payload.requests))
    throw new Error('レスポンス形式不正');
  const ids=new Set();
  for(const item of payload.requests){
    if(!item||!/^[0-9a-f-]{36}$/i.test(String(item.id||''))||
       !/^D[0-9]{6}$/.test(String(item.driver_id||''))||
       ids.has(item.id))throw new Error('申請IDまたはDriverID不正');
    if(item.requested_phone!==null&&item.requested_phone!==undefined&&
       !/^0[0-9]{9,10}$/.test(String(item.requested_phone)))
       throw new Error('電話番号形式不正');
    if(item.requested_email!==null&&item.requested_email!==undefined&&
       !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(item.requested_email)))
       throw new Error('メール形式不正');
    ids.add(item.id);
  }
  console.log('自動承認済み未反映の申請件数: '+payload.requests.length);
  return {status:'READ_ONLY',count:payload.requests.length};
}
