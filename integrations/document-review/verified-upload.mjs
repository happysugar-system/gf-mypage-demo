export function validateSubmission(request,driverId,bytes,mime){
 if(!request||request.driver_id!==driverId||request.status!=='requested')throw Error('request_not_available');
 if(!['driver_license','residence_certificate'].includes(request.document_type))throw Error('invalid_document');
 if(!(bytes instanceof Uint8Array)||bytes.length<8||bytes.length>(request.document_type==='residence_certificate'?4000000:10485760)||mime!=='application/pdf')throw Error('invalid_pdf');
 if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-'||!/%%EOF\s*$/.test(String.fromCharCode(...bytes.slice(-1024))))throw Error('invalid_pdf');
 return {requestId:request.id,receiptId:request.receipt_id,driverId,documentType:request.document_type};
}
export async function submitVerifiedDocument({requestId,driverId,bytes,mime,loadRequest,savePrivate,markSubmitted}){
 const verified=validateSubmission(await loadRequest(requestId,driverId),driverId,bytes,mime);
 const saved=await savePrivate(verified,bytes);
 if(!saved?.fileId||saved.verified!==true)throw Error('storage_not_verified');
 const result=await markSubmitted(verified,saved.fileId);
 if(result?.status!=='submitted')throw Error('reconciliation_required');
 return {status:'submitted'};
}

// Server-only adapter; db must be the authenticated server's service client.
export async function recordDriveAttempt(db,verified,fileId){
 const {data,error}=await db.rpc('gf_record_document_attempt',{p_request:verified.requestId,p_driver:verified.driverId,p_file:fileId});
 if(error||typeof data!=='string'||!data)throw Error('reconciliation_required');
 return {status:'submitted',attemptId:data};
}
