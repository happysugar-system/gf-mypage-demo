/** Internal dispatcher for the existing GAS router. Never call from google.script.run. */
function GF_DocumentApprovalBridge_(envelope,assertPrivate){
 const props=PropertiesService.getScriptProperties();
 const secret=props.getProperty('GF_DOCUMENT_BRIDGE_SECRET');
 if(!secret||secret.length<32||!envelope||typeof envelope.payload!=='string'||envelope.payload.length>8192)throw Error('bridge_not_authorized');
 const expected=Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(envelope.payload,secret)).replace(/=+$/,'');
 const supplied=String(envelope.signature||'');let diff=expected.length^supplied.length;
 for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^(supplied.charCodeAt(i)||0);
 if(diff!==0)throw Error('bridge_not_authorized');
 const p=JSON.parse(envelope.payload);
 if(p.action!=='document_review_approve'||!Number.isSafeInteger(p.issuedAt)||Math.abs(Date.now()-p.issuedAt)>60000||!(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(p.nonce)))throw Error('bridge_expired');
 const lock=LockService.getScriptLock();lock.waitLock(10000);
 try{
 const now=Date.now();
 if(Math.abs(now-p.issuedAt)>60000)throw Error('bridge_expired');
 const key='GF_DOCUMENT_BRIDGE_NONCES';
 const recent=JSON.parse(props.getProperty(key)||'{}');
 for(const nonce of Object.keys(recent))if(recent[nonce]<now)delete recent[nonce];
 if(Object.prototype.hasOwnProperty.call(recent,p.nonce))throw Error('bridge_replay');
 if(Object.keys(recent).length>=120)throw Error('bridge_busy');
 recent[p.nonce]=p.issuedAt+60000;
 props.setProperty(key,JSON.stringify(recent));
 }finally{lock.releaseLock();}
 return GF_DocumentApprovalSave_(p.review,()=>true,assertPrivate);
}

/** Call from the active doPost before existing route dispatch. */
function GF_DocumentApprovalRoute_(e){
 if(e?.parameter?.gf_document_bridge!=='approval_v1')return null;
 let result;
 try{
  const raw=e?.postData?.contents;
  if(typeof raw!=='string'||raw.length>17000)throw Error('invalid_envelope');
  result=GF_DocumentApprovalBridge_(JSON.parse(raw),GF_DocumentPrivateDrive_);
 }catch(error){
  const code=String(error.message||'');
  result={verified:false,error:/^bridge_[a-z_]+$/.test(code)?code:'approval_not_verified'};
 }
 return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

/** Drive v3 effective permissions must all resolve to approved individual users. */
function GF_DocumentPrivateDrive_(item){
 const props=PropertiesService.getScriptProperties();
 const permitted=new Set(String(props.getProperty('GF_DOCUMENT_DRIVE_ALLOWED_EMAILS')||'')
  .split(',').map(email=>email.trim().toLowerCase()).filter(Boolean));
 if(!permitted.size||item.getSharingAccess()!==DriveApp.Access.PRIVATE)return false;
 let pageToken;
 let found=false;
 do{
  const page=Drive.Permissions.list(item.getId(),{
   supportsAllDrives:true,pageToken,fields:'nextPageToken,permissions(type,emailAddress,deleted)'
  });
  for(const permission of page.permissions||[]){
   if(permission.deleted)continue;
   if(permission.type!=='user'||!permitted.has(String(permission.emailAddress||'').toLowerCase()))return false;
   found=true;
  }
  pageToken=page.nextPageToken;
 }while(pageToken);
 return found;
}
