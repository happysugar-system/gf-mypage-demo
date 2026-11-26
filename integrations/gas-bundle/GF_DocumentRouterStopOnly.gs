/** Initial installation: no storage, credentials, or external calls. */
function GF_DocumentCombinedRoute_(e) {
  if (e?.parameter?.gf_document_bridge === undefined) return null;
  return ContentService.createTextOutput(JSON.stringify({verified:false,error:'bridge_disabled'})).setMimeType(ContentService.MimeType.JSON);
}
function GF_DocumentStopOnlyCheck() {
  if (GF_DocumentCombinedRoute_({parameter:{action:'gf190_receipt'}})!==null) throw Error('legacy_route_failed');
  for (const action of ['approval_v1','resubmission_v1','unknown']) {
    const result=JSON.parse(GF_DocumentCombinedRoute_({parameter:{gf_document_bridge:action}}).getContent());
    if(result.verified!==false||result.error!=='bridge_disabled') throw Error('stop_failed');
  }
  console.log('PASS: legacy route and all document stops');
}
