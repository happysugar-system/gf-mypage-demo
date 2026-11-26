/** Run manually in the intended test GAS editor. No writes or secrets logged. */
function GF_DocumentPreflight(){
 const p=PropertiesService.getScriptProperties();
 const checks={
  router:typeof doPost==='function',
  combined:typeof GF_DocumentCombinedRoute_==='function',
  book:typeof GF215_BOOK_ID!=='undefined',
  receipt:typeof GF215_シート検査_==='function',
  row:typeof GF215_一致行_==='function',
  parent:typeof GF216_直下_==='function',
  existing:typeof GF216_既存ファイル_==='function',
  link:typeof GF216_リンク式_==='function',
  drive:typeof Drive!=='undefined',
  sheets:typeof Sheets!=='undefined',
  targetMatches:typeof GF215_BOOK_ID!=='undefined'&&p.getProperty('GF_DOCUMENT_APPROVAL_SHEET_ID')===GF215_BOOK_ID,
  rootConfigured:!!p.getProperty('GF216_PROD_FOLDER_ID'),
  secretConfigured:(p.getProperty('GF_DOCUMENT_BRIDGE_SECRET')||'').length>=32,
  allowedEmailsConfigured:!!p.getProperty('GF_DOCUMENT_DRIVE_ALLOWED_EMAILS'),
  writesDisabled:p.getProperty('GF_DOCUMENT_RESUBMISSION_WRITE_ENABLED')!=='YES'&&p.getProperty('GF_DOCUMENT_APPROVAL_WRITE_ENABLED')!=='YES'
 };
 console.log(JSON.stringify(checks,null,2));
 return checks;
}
