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
 if(p.action!=='document_review_approve'||!Number.isSafeInteger(p.issuedAt)||Math.abs(Date.now()-p.issuedAt)>60000||!/^[-a-f0-9]{36}$/i.test(p.nonce))throw Error('bridge_expired');
 const lock=LockService.getUserLock();lock.waitLock(10000);
 try{
 const cache=CacheService.getScriptCache(),key='GF_DOC_NONCE_'+p.nonce;
 if(cache.get(key))throw Error('bridge_replay');
 cache.put(key,'1',180);
 }finally{lock.releaseLock();}
 return GF_DocumentApprovalSave_(p.review,()=>true,assertPrivate);
}
