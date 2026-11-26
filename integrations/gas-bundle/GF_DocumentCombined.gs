/** TEST ONLY. Install instead of the four individual files, never alongside them. */

// ===== GF_DocumentResubmissionBridge.gs =====
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


// ===== GF_DocumentResubmissionSave.gs =====
/** Internal GAS adapter. Never expose as an unauthenticated web action.
 * resolveVerified must resolve request and folder from server-side receipt ownership.
 * assertPrivate must verify effective Drive access, including inherited permissions.
 */
function GF_DocumentResubmissionSave_(requestId,blob,resolveVerified,assertPrivate){
 if(typeof resolveVerified!=='function'||typeof assertPrivate!=='function')throw Error('adapter_not_connected');
 const lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
 const r=resolveVerified(requestId);
 if(!r||r.status!=='requested'||r.verified!==true||!r.driverId||!r.receiptId)throw Error('request_not_verified');
 if(!/^[0-9a-f-]{36}$/i.test(requestId))throw Error('invalid_request_id');
 const type=r.documentType,mime=blob.getContentType(),bytes=blob.getBytes();
 if(!['driver_license','residence_certificate'].includes(type)||mime!=='application/pdf'||bytes.length<5||bytes.length>(type==='residence_certificate'?4000000:10485760)||bytes.slice(0,5).map(x=>String.fromCharCode(x&255)).join('')!=='%PDF-')throw Error('invalid_pdf');
 const props=PropertiesService.getScriptProperties();
 if(props.getProperty('GF_DOCUMENT_RESUBMISSION_WRITE_ENABLED')!=='YES')throw Error('resubmission_write_disabled');
 const target=props.getProperty('GF_DOCUMENT_APPROVAL_SHEET_ID');
 if(!target||target!==GF_DocumentDemoTarget_().sheetId)throw Error('sheet_target_not_verified');
 const req=GF_DocumentReceiptSheet_();
 const headers=req.getRange(1,1,1,req.getLastColumn()).getDisplayValues()[0];
 const column=name=>{
  if(headers.filter(h=>h===name).length!==1)throw Error('receipt_headers_invalid');
  return headers.indexOf(name)+1;
 };
 const rows=GF_DocumentRows_(req,column('受付番号'),r.receiptId);
 if(rows.length!==1)throw Error('receipt_not_unique');
 const cell=name=>req.getRange(rows[0],column(name));
 if(cell('確認DriverID').getDisplayValue()!==r.driverId||cell('契約状況').getDisplayValue()==='契約完了')throw Error('receipt_not_editable');
 if(type==='residence_certificate'&&/郵送/.test(cell('住民票PDF').getDisplayValue()+' '+cell('書類状態').getDisplayValue()))throw Error('postal_no_upload_required');
 const folder=/^https:\/\/drive\.google\.com\/drive\/folders\/([\w-]+)$/.exec(String(cell('書類フォルダ').getValue()));
 if(!folder||(r.folderId&&folder[1]!==r.folderId))throw Error('folder_not_verified');
 const root=DriveApp.getFolderById(props.getProperty('GF_DOCUMENT_DEMO_FOLDER_ID'));
 const parent=DriveApp.getFolderById(folder[1]);
 if(!GF_DocumentDirectChild_(root,parent)||assertPrivate(root)!==true||assertPrivate(parent)!==true)throw Error('folder_access_not_verified');
 const folders=parent.getFoldersByName(type==='driver_license'?'免許証':'住民票');
 if(!folders.hasNext())throw Error('existing_document_folder_missing');
 const dir=folders.next();
 if(folders.hasNext())throw Error('duplicate_document_folder');
 if(assertPrivate(dir)!==true)throw Error('folder_access_not_verified');
 const digest=b=>Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,b));
 const name='再提出_'+requestId+'_'+digest(bytes).replace(/=+$/,'')+'.pdf';
 // A retry may reuse the same bytes, but a different PDF must not create a second file for this request.
 const prior=dir.getFiles();
 while(prior.hasNext()){
  const f=prior.next();
  if(!f.isTrashed()&&f.getName().startsWith('再提出_'+requestId+'_')&&f.getName()!==name)throw Error('submission_conflict');
 }
 const existing=GF_DocumentExistingFile_(dir,name);
 if(existing){if(existing.isTrashed()||existing.getMimeType()!=='application/pdf'||assertPrivate(existing)!==true||digest(existing.getBlob().getBytes())!==digest(bytes))throw Error('submission_conflict');return {fileId:existing.getId(),reused:true,verified:true};}
 const saved=dir.createFile(blob.copyBlob().setName(name));
 if(digest(saved.getBlob().getBytes())!==digest(bytes)||assertPrivate(dir)!==true||assertPrivate(saved)!==true)throw Error('saved_file_not_verified');
 return {fileId:saved.getId(),reused:false,verified:true};
 }finally{lock.releaseLock();}
}


// ===== GF_DocumentApprovalBridge.gs =====
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


// ===== GF_DocumentApprovalSave.gs =====
/** Internal only. Caller must verify staff and resolve current submitted attempt server-side.
 * Uses the existing GF215/GF216 receipt and Drive helpers. No public web action.
 */
function GF_DocumentApprovalSave_(review,authorizeStaff,assertPrivate){
 if(typeof authorizeStaff!=='function'||authorizeStaff()!==true||typeof assertPrivate!=='function')throw Error('not_authorized');
 const props=PropertiesService.getScriptProperties();
 if(props.getProperty('GF_DOCUMENT_APPROVAL_WRITE_ENABLED')!=='YES')throw Error('approval_write_disabled');
 if(!props.getProperty('GF_DOCUMENT_APPROVAL_SHEET_ID')||props.getProperty('GF_DOCUMENT_APPROVAL_SHEET_ID')!==GF_DocumentDemoTarget_().sheetId)throw Error('sheet_target_not_verified');
 if(!review||review.status!=='submitted'||review.verified!==true||!review.receiptId||!review.driverId||!/^[A-Za-z0-9_-]{10,200}$/.test(review.fileId))throw Error('invalid_review');
 const type=review.documentType;
 if(!['driver_license','residence_certificate'].includes(type))throw Error('invalid_document');
 const lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
 const req=GF_DocumentReceiptSheet_();
 const h=req.getRange(1,1,1,req.getLastColumn()).getDisplayValues()[0];
 const col=k=>{if(h.filter(x=>x===k).length!==1)throw Error('invalid_header_'+k);return h.indexOf(k)+1;};
 const hits=GF_DocumentRows_(req,col('受付番号'),review.receiptId);
 if(hits.length!==1)throw Error('receipt_not_unique');
 const row=hits[0],cell=k=>req.getRange(row,col(k));
 if(cell('確認DriverID').getDisplayValue()!==review.driverId||cell('契約状況').getDisplayValue()==='契約完了')throw Error('receipt_not_editable');
 if(type==='residence_certificate'&&/郵送/.test(cell('住民票PDF').getDisplayValue()+' '+cell('書類状態').getDisplayValue()))throw Error('postal_no_upload_required');
 const root=DriveApp.getFolderById(props.getProperty('GF_DOCUMENT_DEMO_FOLDER_ID'));
 const match=/^https:\/\/drive\.google\.com\/drive\/folders\/([\w-]+)$/.exec(String(cell('書類フォルダ').getValue()));
 if(!match)throw Error('folder_not_verified');
 const parent=DriveApp.getFolderById(match[1]);
 if(!GF_DocumentDirectChild_(root,parent)||assertPrivate(root)!==true||assertPrivate(parent)!==true)throw Error('folder_not_verified');
 const dirs=parent.getFoldersByName(type==='driver_license'?'免許証':'住民票');
 if(!dirs.hasNext())throw Error('folder_missing');
 const dir=dirs.next();if(dirs.hasNext()||assertPrivate(dir)!==true)throw Error('folder_not_verified');
 const file=DriveApp.getFileById(review.fileId);
 const parents=file.getParents();let inside=false;while(parents.hasNext())if(parents.next().getId()===dir.getId())inside=true;
 if(!inside||file.isTrashed()||file.getMimeType()!=='application/pdf'||assertPrivate(file)!==true)throw Error('file_not_verified');
 const link=cell(type==='driver_license'?'免許証PDF':'住民票PDF'),check=cell(type==='driver_license'?'免許証確認':'住民票確認');
 const formula=GF_DocumentLink_(file.getUrl(),type==='driver_license'?'🪪免許証を見る':'📄住民票を見る');
 const change=(target,userEnteredValue)=>({updateCells:{
  start:{sheetId:req.getSheetId(),rowIndex:row-1,columnIndex:target.getColumn()-1},
  rows:[{values:[{userEnteredValue}]}],fields:'userEnteredValue'
 }});
 Sheets.Spreadsheets.batchUpdate({requests:[change(link,{formulaValue:formula}),change(check,{stringValue:'確認OK'})]},GF_DocumentDemoTarget_().sheetId);
 SpreadsheetApp.flush();
 if(cell('確認DriverID').getDisplayValue()!==review.driverId||cell('受付番号').getDisplayValue()!==review.receiptId||link.getFormula()!==formula||check.getDisplayValue()!=='確認OK')throw Error('sheet_not_verified');
 return {verified:true,fileId:review.fileId};
 }finally{lock.releaseLock();}
}

/** Call first in existing doPost. Unknown bridge actions fail closed. */
function GF_DocumentCombinedRoute_(e){
 const action=e?.parameter?.gf_document_bridge;
 if(action===undefined)return null;
 if(action==='resubmission_v1')return GF_DocumentResubmissionRoute_(e);
 if(action==='approval_v1')return GF_DocumentApprovalRoute_(e);
 return ContentService.createTextOutput(JSON.stringify({verified:false,error:'unknown_bridge'})).setMimeType(ContentService.MimeType.JSON);
}

/** Document-only schema validation; additional columns and column order are permitted. */
function GF_DocumentReceiptSheet_(){
 const p=PropertiesService.getScriptProperties();
 const id=p.getProperty('GF_DOCUMENT_APPROVAL_SHEET_ID');
 if(!id||id!==GF_DocumentDemoTarget_().sheetId)throw Error('sheet_target_not_verified');
 const req=SpreadsheetApp.openById(id).getSheetByName('車両依頼受付');
 if(!req)throw Error('receipt_sheet_missing');
 const headers=req.getRange(1,1,1,req.getLastColumn()).getDisplayValues()[0];
 const required=['受付番号','確認DriverID','契約状況','免許証PDF','住民票PDF','書類状態','書類フォルダ','免許証確認','住民票確認'];
 for(const name of required)if(headers.filter(h=>h===name).length!==1)throw Error('receipt_headers_invalid');
 return req;
}

/** Explicit test-only target; no fallback to legacy production constants. */
function GF_DocumentDemoTarget_(){
 const p=PropertiesService.getScriptProperties();
 const sheetId=p.getProperty('GF_DOCUMENT_DEMO_SHEET_ID'),folderId=p.getProperty('GF_DOCUMENT_DEMO_FOLDER_ID');
 if(p.getProperty('GF_DOCUMENT_ENV')!=='DEMO'||p.getProperty('GF_DOCUMENT_DEMO_SCRIPT_ID')!==ScriptApp.getScriptId()||!sheetId||!folderId||p.getProperty('GF_DOCUMENT_APPROVAL_SHEET_ID')!==sheetId)throw Error('demo_target_not_verified');
 return {sheetId,folderId};
}
function GF_DocumentRows_(sheet,col,value){
 const count=sheet.getLastRow()-1;if(count<=0)return [];
 return sheet.getRange(2,col,count,1).getDisplayValues().flatMap((r,i)=>r[0]===value?[i+2]:[]);
}
function GF_DocumentDirectChild_(parent,child){const it=child.getParents();while(it.hasNext())if(it.next().getId()===parent.getId())return true;return false;}
function GF_DocumentExistingFile_(folder,name){const it=folder.getFilesByName(name);if(!it.hasNext())return null;const f=it.next();if(it.hasNext())throw Error('duplicate_file');return f;}
function GF_DocumentLink_(url,label){return '=HYPERLINK("'+url.replace(/"/g,'')+'","'+label+'")';}
