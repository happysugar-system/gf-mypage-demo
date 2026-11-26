import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const source=readFileSync(new URL('./GF_DocumentApprovalBridge.gs',import.meta.url),'utf8');
const secret='synthetic-test-secret-with-more-than-32-characters';
function fixture(){
 const properties=new Map([['GF_DOCUMENT_BRIDGE_SECRET',secret],['GF_DOCUMENT_DRIVE_ALLOWED_EMAILS','staff@example.test']]);
 let saves=0,locked=false;
 const mocks={
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)})},
  Utilities:{computeHmacSha256Signature:(p,s)=>createHmac('sha256',s).update(p).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url')},
  LockService:{getScriptLock:()=>({waitLock:()=>{assert.equal(locked,false);locked=true},releaseLock:()=>{locked=false}})},
  GF_DocumentApprovalSave_:(review,authorize,privateItem)=>{assert.equal(locked,false);assert.equal(authorize(),true);assert.equal(privateItem({getId:()=>review.fileId,getSharingAccess:()=>'PRIVATE'}),true);saves++;return {verified:true,fileId:review.fileId}},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})},
  DriveApp:{Access:{PRIVATE:'PRIVATE'}},
  Drive:{Permissions:{list:()=>({permissions:[{type:'user',emailAddress:'staff@example.test'}]})}},
 };
 const load=()=>new Function(...Object.keys(mocks),source+';return {route:GF_DocumentApprovalRoute_,privateDrive:GF_DocumentPrivateDrive_};')(...Object.values(mocks));
 return {load,mocks,saves:()=>saves};
}
function request(overrides={}){
 const payload=JSON.stringify({action:'document_review_approve',issuedAt:Date.now(),nonce:'00000000-0000-4000-8000-000000000000',review:{fileId:'synthetic-file-id'},...overrides});
 const signature=createHmac('sha256',secret).update(payload).digest('base64url');
 return {parameter:{gf_document_bridge:'approval_v1'},postData:{contents:JSON.stringify({payload,signature})}};
}
test('signed request reaches the guarded writer and durable nonce survives a new invocation',()=>{
 const f=fixture(),r=request();
 assert.deepEqual(f.load().route(r),{verified:true,fileId:'synthetic-file-id'});
 assert.equal(f.load().route(r).error,'bridge_replay');
 assert.equal(f.saves(),1);
});
test('existing routes fall through and expired or tampered requests never save',()=>{
 const f=fixture(),{route}=f.load();
 assert.equal(route({parameter:{gf191_action:'test'}}),null);
 assert.equal(route(request({issuedAt:Date.now()-61000})).error,'bridge_expired');
 const r=request(),envelope=JSON.parse(r.postData.contents);
 envelope.payload=envelope.payload.replace('synthetic-file-id','changed-file-id');
 r.postData.contents=JSON.stringify(envelope);
 assert.equal(route(r).error,'bridge_not_authorized');
 assert.equal(f.saves(),0);
});
test('Drive verifies every page and denies broad, group and unapproved access',()=>{
 const f=fixture(),item={getId:()=>'synthetic-file-id',getSharingAccess:()=>'PRIVATE'};
 for(const permission of [{type:'anyone'},{type:'domain'},{type:'group',emailAddress:'staff@example.test'},{type:'user',emailAddress:'other@example.test'}]){
  f.mocks.Drive.Permissions.list=(_,opts)=>opts.pageToken?{permissions:[permission]}:{permissions:[{type:'user',emailAddress:'staff@example.test'}],nextPageToken:'next'};
  assert.equal(f.load().privateDrive(item),false);
 }
});
