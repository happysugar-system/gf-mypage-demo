// Pure review workflow; authorization and durable writes belong to server handlers.
export function documentReviewTransition(record, action, actor, input={}){
 if(!record||!['driver_license','residence_certificate'].includes(record.document_type))throw Error('invalid_document');
 if(action==='submit'){
 if(actor.role!=='driver'||actor.driverId!==record.driver_id||record.status!=='requested')throw Error('not_allowed');
 if(record.document_type==='residence_certificate'&&input.mime!=='application/pdf')throw Error('pdf_required');
 if(record.document_type==='driver_license'&&!['application/pdf','image/jpeg','image/png'].includes(input.mime))throw Error('invalid_file_type');
 if(input.storageVerified!==true)throw Error('upload_not_verified');
 return {...record,status:'submitted'};
 }
 if(actor.role!=='staff'||actor.authorized!==true)throw Error('not_allowed');
 if(action==='approve'&&record.status==='submitted')return {...record,status:'approved'};
 if(action==='request_again'&&record.status==='submitted'&&String(input.reason||'').trim())return {...record,status:'requested',reason:String(input.reason).trim()};
 throw Error('invalid_transition');
}
export function driverDocumentNotices(records,driverId){
 return records.filter(r=>r.driver_id===driverId&&['requested','submitted','approving'].includes(r.status)).map(r=>({id:r.id,document_type:r.document_type,reason:r.reason,status:r.status==='approving'?'submitted':r.status}));
}
