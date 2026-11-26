/** Internal approval adapter: only invoke after existing staff authorization.
 * resolve must verify request, receipt, driver, saved file and effective Drive access.
 * writeAndVerify must serialize sheet updates and re-read identity and target cells.
 */
export async function approveDocument({requestId,staff,resolve,writeAndVerify,markApproved}){
 if(!staff?.authorized||!['owner','staff'].includes(staff.role))throw Error('not_authorized');
 const r=await resolve(requestId);
 if(!r||r.id!==requestId||r.status!=='submitted'||r.verified!==true||!r.receiptId||!r.driverId||!r.fileId||!/^[A-Za-z0-9_-]{10,}$/.test(r.fileId))throw Error('submission_not_verified');
 const fields={driver_license:['免許証PDF','免許証確認'],residence_certificate:['住民票PDF','住民票確認']}[r.documentType];
 if(!fields)throw Error('invalid_document');
 const changes={[fields[0]]:'https://drive.google.com/file/d/'+r.fileId+'/view',[fields[1]]:'確認OK'};
 const saved=await writeAndVerify({receiptId:r.receiptId,driverId:r.driverId,changes});
 if(saved!==true)throw Error('sheet_not_verified');
 const result=await markApproved({id:r.id,receiptId:r.receiptId,driverId:r.driverId,expectedStatus:'submitted',fileId:r.fileId});
 if(result?.status!=='approved')throw Error('reconciliation_required');
 return {status:'approved'};
}
