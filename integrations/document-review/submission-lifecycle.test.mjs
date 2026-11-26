import {documentReviewTransition,driverDocumentNotices} from './workflow.mjs';
import {submitVerifiedDocument} from './verified-upload.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const record={id:'TEST-R',receipt_id:'TEST-A',driver_id:'TEST-D',document_type:'residence_certificate',reason:'test',status:'requested'};
const bytes=new TextEncoder().encode('%PDF-1.4\n%%EOF\n');
test('save failure preserves request and does not update DB',async()=>{
 let writes=0;
 for(const savePrivate of [async()=>{throw Error('drive_failed')},async()=>({fileId:'test',verified:false})]){
 await assert.rejects(submitVerifiedDocument({requestId:record.id,driverId:record.driver_id,bytes,mime:'application/pdf',loadRequest:async()=>record,savePrivate,markSubmitted:async()=>{writes++;}}));
 }
 assert.equal(writes,0);
});
test('verified save precedes status update; notice remains until approval',async()=>{
 let current=record;const order=[];
 await submitVerifiedDocument({requestId:record.id,driverId:record.driver_id,bytes,mime:'application/pdf',loadRequest:async()=>current,savePrivate:async()=>{order.push('save');return {fileId:'test',verified:true}},markSubmitted:async()=>{order.push('update');current={...current,status:'submitted'};return current}});
 assert.deepEqual(order,['save','update']);
 assert.equal(driverDocumentNotices([current],record.driver_id).length,1);
 assert.equal(driverDocumentNotices([current],'OTHER').length,0);
 assert.throws(()=>documentReviewTransition(current,'approve',{role:'driver',driverId:record.driver_id}));
 current=documentReviewTransition(current,'approve',{role:'staff',authorized:true});
 assert.equal(driverDocumentNotices([current],record.driver_id).length,0);
});
test('failed status update after save requires reconciliation',async()=>{
 await assert.rejects(submitVerifiedDocument({requestId:record.id,driverId:record.driver_id,bytes,mime:'application/pdf',loadRequest:async()=>record,savePrivate:async()=>({fileId:'test',verified:true}),markSubmitted:async()=>null}),/reconciliation_required/);
});
