/** Internal GAS adapter. Never expose as an unauthenticated web action.
 * resolveVerified must resolve request and folder from server-side receipt ownership.
 * assertPrivate must verify effective Drive access, including inherited permissions.
 */
function GF_DocumentResubmissionSave_(requestId,blob,resolveVerified,assertPrivate){
 if(typeof resolveVerified!=='function'||typeof assertPrivate!=='function')throw Error('adapter_not_connected');
 const lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
 const r=resolveVerified(requestId);
 if(!r||r.status!=='requested'||r.verified!==true||!r.folderId||!r.driverId||!r.receiptId)throw Error('request_not_verified');
 if(!/^[0-9a-f-]{36}$/i.test(requestId))throw Error('invalid_request_id');
 const type=r.documentType,mime=blob.getContentType(),bytes=blob.getBytes();
 if(!['driver_license','residence_certificate'].includes(type)||mime!=='application/pdf'||bytes.length<5||bytes.length>(type==='residence_certificate'?4000000:10485760)||bytes.slice(0,5).map(x=>String.fromCharCode(x&255)).join('')!=='%PDF-')throw Error('invalid_pdf');
 const parent=DriveApp.getFolderById(r.folderId);
 if(assertPrivate(parent)!==true)throw Error('folder_access_not_verified');
 const folders=parent.getFoldersByName(type==='driver_license'?'免許証':'住民票');
 if(!folders.hasNext())throw Error('existing_document_folder_missing');
 const dir=folders.next();
 if(folders.hasNext())throw Error('duplicate_document_folder');
 if(assertPrivate(dir)!==true)throw Error('folder_access_not_verified');
 const name='再提出_'+requestId+'.pdf';
 const digest=b=>Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,b));
 const existing=GF216_既存ファイル_(dir,name);
 if(existing){if(digest(existing.getBlob().getBytes())!==digest(bytes))throw Error('submission_conflict');return {fileId:existing.getId(),reused:true};}
 const saved=dir.createFile(blob.copyBlob().setName(name));
 return {fileId:saved.getId(),reused:false};
 }finally{lock.releaseLock();}
}
