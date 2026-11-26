import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source=readFileSync(new URL('./GF_DocumentResubmissionSave.gs',import.meta.url),'utf8');
const id='00000000-0000-4000-8000-000000000001';
const iterator=items=>{let i=0;return {hasNext:()=>i<items.length,next:()=>items[i++]};};
function fixture(postal=false){
 const files=[];let locked=false;
 const blob=text=>({getContentType:()=> 'application/pdf',getBytes:()=>Buffer.from(text),copyBlob:()=>({setName:name=>({name,text})})});
 const dir={getFiles:()=>iterator(files),createFile:b=>{const f={getName:()=>b.name,getId:()=>String(files.length+1),isTrashed:()=>false,getMimeType:()=> 'application/pdf',getBlob:()=>blob(b.text)};files.push(f);return f;}};
 const parent={getFoldersByName:()=>iterator([dir])};
 const headers=['受付番号','確認DriverID','契約状況','住民票PDF','書類状態','書類フォルダ'];
 const values=['R1','D1','未送信',postal?'郵送':'','','https://drive.google.com/drive/folders/folder1'];
 const req={getLastColumn:()=>headers.length,getRange:(row,col)=>row===1?{getDisplayValues:()=>[headers]}:{getDisplayValue:()=>values[col-1],getValue:()=>values[col-1]}};
 const props={GF_DOCUMENT_RESUBMISSION_WRITE_ENABLED:'YES',GF_DOCUMENT_APPROVAL_SHEET_ID:'test-sheet',GF216_PROD_FOLDER_ID:'root'};
 const mocks={LockService:{getScriptLock:()=>({waitLock:()=>{assert.equal(locked,false);locked=true;},releaseLock:()=>{locked=false;}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},GF215_BOOK_ID:'test-sheet',GF215_シート検査_:()=>({req}),GF215_一致行_:()=>[2],DriveApp:{getFolderById:()=>parent},GF216_直下_:()=>true,GF216_既存ファイル_:(_,name)=>files.find(f=>f.getName()===name),Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,b)=>createHash('sha256').update(b).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url')}};
 const save=new Function(...Object.keys(mocks),source+';return GF_DocumentResubmissionSave_;')(...Object.values(mocks));
 return {files,run:(text,type='driver_license')=>save(id,blob(text),()=>({status:'requested',verified:true,folderId:'folder1',driverId:'D1',receiptId:'R1',documentType:type}),()=>true),locked:()=>locked};
}
test('same PDF retry reuses file; changed PDF is rejected',()=>{const f=fixture();assert.equal(f.run('%PDF-one').reused,false);assert.equal(f.run('%PDF-one').reused,true);assert.throws(()=>f.run('%PDF-two'),/submission_conflict/);assert.equal(f.files.length,1);assert.equal(f.locked(),false);});
test('postal residence certificate is rejected before Drive write',()=>{const f=fixture(true);assert.throws(()=>f.run('%PDF-one','residence_certificate'),/postal_no_upload_required/);assert.equal(f.files.length,0);assert.equal(f.locked(),false);});
