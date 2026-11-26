/** Read-only diagnostic. Never logs IDs, emails, or secrets. */
function GF_DocumentPreflight(){
 const p=PropertiesService.getScriptProperties();
 const checks={router:typeof doPost==='function',combined:typeof GF_DocumentCombinedRoute_==='function',drive:typeof Drive!=='undefined',sheets:typeof Sheets!=='undefined',writesDisabled:p.getProperty('GF_DOCUMENT_RESUBMISSION_WRITE_ENABLED')!=='YES'&&p.getProperty('GF_DOCUMENT_APPROVAL_WRITE_ENABLED')!=='YES',secretConfigured:(p.getProperty('GF_DOCUMENT_BRIDGE_SECRET')||'').length>=32,allowedEmailsConfigured:!!p.getProperty('GF_DOCUMENT_DRIVE_ALLOWED_EMAILS'),targetVerified:false,receiptSchema:false,folderPrivate:false};
 if(checks.writesDisabled&&checks.combined){
 try{const t=GF_DocumentDemoTarget_();checks.targetVerified=true;
 checks.receiptSchema=!!GF_DocumentReceiptSheet_();
 const folder=DriveApp.getFolderById(t.folderId);checks.folderPrivate=!folder.isTrashed()&&GF_DocumentPrivateDrive_(folder)===true;
 }catch(e){checks.diagnosticFailed=true;}
 }
 checks.ready=Object.keys(checks).every(k=>checks[k]===true)&&!checks.diagnosticFailed;
 console.log(JSON.stringify(checks,null,2));return checks;
}
