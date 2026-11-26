/** Internal only. Caller must verify staff and resolve current submitted attempt server-side.
 * Uses the existing GF215/GF216 receipt and Drive helpers. No public web action.
 */
function GF_DocumentApprovalSave_(review,authorizeStaff,assertPrivate){
 if(typeof authorizeStaff!=='function'||authorizeStaff()!==true||typeof assertPrivate!=='function')throw Error('not_authorized');
 const props=PropertiesService.getScriptProperties();
 if(props.getProperty('GF_DOCUMENT_APPROVAL_WRITE_ENABLED')!=='YES')throw Error('approval_write_disabled');
 if(!props.getProperty('GF_DOCUMENT_APPROVAL_SHEET_ID')||props.getProperty('GF_DOCUMENT_APPROVAL_SHEET_ID')!==GF215_BOOK_ID)throw Error('sheet_target_not_verified');
 if(!review||review.status!=='submitted'||review.verified!==true||!review.receiptId||!review.driverId||!/^[A-Za-z0-9_-]{10,200}$/.test(review.fileId))throw Error('invalid_review');
 const type=review.documentType;
 if(!['driver_license','residence_certificate'].includes(type))throw Error('invalid_document');
 const lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
 const req=GF215_シート検査_().req;
 const h=req.getRange(1,1,1,req.getLastColumn()).getDisplayValues()[0];
 const col=k=>{if(h.filter(x=>x===k).length!==1)throw Error('invalid_header_'+k);return h.indexOf(k)+1;};
 const hits=GF215_一致行_(req,col('受付番号'),review.receiptId);
 if(hits.length!==1)throw Error('receipt_not_unique');
 const row=hits[0],cell=k=>req.getRange(row,col(k));
 if(cell('確認DriverID').getDisplayValue()!==review.driverId||cell('契約状況').getDisplayValue()==='契約完了')throw Error('receipt_not_editable');
 if(type==='residence_certificate'&&/郵送/.test(cell('住民票PDF').getDisplayValue()+' '+cell('書類状態').getDisplayValue()))throw Error('postal_no_upload_required');
 const root=DriveApp.getFolderById(props.getProperty('GF216_PROD_FOLDER_ID'));
 const match=/^https:\/\/drive\.google\.com\/drive\/folders\/([\w-]+)$/.exec(String(cell('書類フォルダ').getValue()));
 if(!match)throw Error('folder_not_verified');
 const parent=DriveApp.getFolderById(match[1]);
 if(!GF216_直下_(root,parent)||assertPrivate(root)!==true||assertPrivate(parent)!==true)throw Error('folder_not_verified');
 const dirs=parent.getFoldersByName(type==='driver_license'?'免許証':'住民票');
 if(!dirs.hasNext())throw Error('folder_missing');
 const dir=dirs.next();if(dirs.hasNext()||assertPrivate(dir)!==true)throw Error('folder_not_verified');
 const file=DriveApp.getFileById(review.fileId);
 const parents=file.getParents();let inside=false;while(parents.hasNext())if(parents.next().getId()===dir.getId())inside=true;
 if(!inside||file.isTrashed()||file.getMimeType()!=='application/pdf'||assertPrivate(file)!==true)throw Error('file_not_verified');
 const link=cell(type==='driver_license'?'免許証PDF':'住民票PDF'),check=cell(type==='driver_license'?'免許証確認':'住民票確認');
 const formula=GF216_リンク式_(file.getUrl(),type==='driver_license'?'🪪免許証を見る':'📄住民票を見る');
 const change=(target,userEnteredValue)=>({updateCells:{
  start:{sheetId:req.getSheetId(),rowIndex:row-1,columnIndex:target.getColumn()-1},
  rows:[{values:[{userEnteredValue}]}],fields:'userEnteredValue'
 }});
 Sheets.Spreadsheets.batchUpdate({requests:[change(link,{formulaValue:formula}),change(check,{stringValue:'確認OK'})]},GF215_BOOK_ID);
 SpreadsheetApp.flush();
 if(cell('確認DriverID').getDisplayValue()!==review.driverId||cell('受付番号').getDisplayValue()!==review.receiptId||link.getFormula()!==formula||check.getDisplayValue()!=='確認OK')throw Error('sheet_not_verified');
 return {verified:true,fileId:review.fileId};
 }finally{lock.releaseLock();}
}
