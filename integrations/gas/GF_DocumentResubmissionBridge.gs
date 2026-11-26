/** Signed server-to-server route. No public google.script.run entrypoint. */
function GF_DocumentResubmissionRoute_(e){
 if(e?.parameter?.gf_document_bridge!=='resubmission_v1')return null;
 let result;
 try{
  const props=PropertiesService.getScriptProperties();
  const secret=props.getProperty('GF_DOCUMENT_BRIDGE_SECRET');
  const raw=e?.postData?.contents;
  if(props.getProperty('GF_DOCUMENT_RESUBMISSION_WRITE_ENABLED')!=='YES'||!secret||secret.length<32||typeof raw!=='string'||raw.length>14500000)throw Error('bridge_not_authorized');
  const env=JSON.parse(raw);
  if(typeof env.payload!=='string'||env.payload.length>14400000||typeof env.signature!=='string')throw Error('bridge_not_authorized');
  const expected=Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(env.payload,secret)).replace(/=+$/,'');
  let diff=expected.length^env.signature.length;
  for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^(env.signature.charCodeAt(i)||0);
  if(diff!==0)throw Error('bridge_not_authorized');
  const p=JSON.parse(env.payload);
  const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
  if(p.action!=='document_resubmission_save'||!Number.isSafeInteger(p.issuedAt)||Math.abs(Date.now()-p.issuedAt)>60000||!uuid.test(p.nonce)||!uuid.test(p.requestId))throw Error('bridge_expired');
  if(typeof p.pdfBase64!=='string'||p.pdfBase64.length>13981016||!/^[A-Za-z0-9+/]+={0,2}$/.test(p.pdfBase64))throw Error('invalid_pdf');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
   const now=Date.now();
   if(Math.abs(now-p.issuedAt)>60000)throw Error('bridge_expired');
   const key='GF_DOCUMENT_BRIDGE_NONCES';
   const recent=JSON.parse(props.getProperty(key)||'{}');
   for(const n of Object.keys(recent))if(recent[n]<now)delete recent[n];
   if(Object.prototype.hasOwnProperty.call(recent,p.nonce))throw Error('bridge_replay');
   if(Object.keys(recent).length>=120)throw Error('bridge_busy');
   recent[p.nonce]=p.issuedAt+60000;props.setProperty(key,JSON.stringify(recent));
  }finally{lock.releaseLock();}
  const r=p.request;
  if(!r||r.id!==p.requestId||r.status!=='requested'||r.verified!==true)throw Error('request_not_verified');
  const blob=Utilities.newBlob(Utilities.base64Decode(p.pdfBase64),'application/pdf');
  result=GF_DocumentResubmissionSave_(p.requestId,blob,id=>id===r.id?r:null,GF_DocumentPrivateDrive_);
 }catch(error){
  const code=String(error.message||'');
  result={verified:false,error:/^bridge_[a-z_]+$/.test(code)?code:'resubmission_not_verified'};
 }
 return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
