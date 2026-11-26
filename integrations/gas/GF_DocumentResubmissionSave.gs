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
 const props=PropertiesService.getScriptProperties();
 if(props.getProperty('GF_DOCUMENT_RESUBMISSION_WRITE_ENABLED')!=='YES')throw Error('resubmission_write_disabled');
 const target=props.getProperty('GF_DOCUMENT_APPROVAL_SHEET_ID');
 if(!target||target!==GF215_BOOK_ID)throw Error('sheet_target_not_verified');
 const req=GF215_シート検査_().req;
 const headers=req.getRange(1,1,1,req.getLastColumn()).getDisplayValues()[0];
 const column=name=>{
  if(headers.filter(h=>h===name).length!==1)throw Error('receipt_headers_invalid');
  return headers.indexOf(name)+1;
 };
 const rows=GF215_一致行_(req,column('受付番号'),r.receiptId);
 if(rows.length!==1)throw Error('receipt_not_unique');
 const cell=name=>req.getRange(rows[0],column(name));
 if(cell('確認DriverID').getDisplayValue()!==r.driverId||cell('契約状況').getDisplayValue()==='契約完了')throw Error('receipt_not_editable');
 if(type==='residence_certificate'&&/郵送/.test(cell('住民票PDF').getDisplayValue()+' '+cell('書類状態').getDisplayValue()))throw Error('postal_no_upload_required');
 const folder=/^https:\/\/drive\.google\.com\/drive\/folders\/([\w-]+)$/.exec(String(cell('書類フォルダ').getValue()));
 if(!folder||folder[1]!==r.folderId)throw Error('folder_not_verified');
 const root=DriveApp.getFolderById(props.getProperty('GF216_PROD_FOLDER_ID'));
 const parent=DriveApp.getFolderById(r.folderId);
 if(!GF216_直下_(root,parent)||assertPrivate(root)!==true||assertPrivate(parent)!==true)throw Error('folder_access_not_verified');
 const folders=parent.getFoldersByName(type==='driver_license'?'免許証':'住民票');
 if(!folders.hasNext())throw Error('existing_document_folder_missing');
 const dir=folders.next();
 if(folders.hasNext())throw Error('duplicate_document_folder');
 if(assertPrivate(dir)!==true)throw Error('folder_access_not_verified');
 const digest=b=>Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,b));
 const name='再提出_'+requestId+'_'+digest(bytes).replace(/=+$/,'')+'.pdf';
 const existing=GF216_既存ファイル_(dir,name);
 if(existing){if(existing.isTrashed()||existing.getMimeType()!=='application/pdf'||assertPrivate(existing)!==true||digest(existing.getBlob().getBytes())!==digest(bytes))throw Error('submission_conflict');return {fileId:existing.getId(),reused:true,verified:true};}
 const saved=dir.createFile(blob.copyBlob().setName(name));
 if(digest(saved.getBlob().getBytes())!==digest(bytes)||assertPrivate(dir)!==true||assertPrivate(saved)!==true)throw Error('saved_file_not_verified');
 return {fileId:saved.getId(),reused:false,verified:true};
 }finally{lock.releaseLock();}
}
