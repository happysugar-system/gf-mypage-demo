import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
const origin='https://happysugar-system.github.io';
Deno.serve(async req=>{
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
async function sendResubmission(request:{id:string;receiptId:string;driverId:string;documentType:"driver_license"|"residence_certificate";status:"requested";verified:true},pdf:Uint8Array){
 if(Deno.env.get("GF_DOCUMENT_RESUBMISSION_BRIDGE_ENABLED")!=="YES")throw new Error("bridge_disabled");
 const secret=Deno.env.get("GF_DOCUMENT_BRIDGE_SECRET")||"";
 const url=new URL(Deno.env.get("GF_DOCUMENT_RESUBMISSION_BRIDGE_URL")||"");
 if(secret.length<32||url.origin!=="https://script.google.com"||!url.pathname.startsWith("/macros/s/")||!url.pathname.endsWith("/exec")||url.username||url.password)throw new Error("bridge_config_invalid");
 if(request.status!=="requested"||request.verified!==true||!request.driverId||!request.receiptId||!["driver_license","residence_certificate"].includes(request.documentType))throw new Error("request_not_verified");
 const max=request.documentType==="residence_certificate"?4000000:10485760;
 if(pdf.length<5||pdf.length>max||new TextDecoder().decode(pdf.subarray(0,5))!=="%PDF-")throw new Error("invalid_pdf");
 let binary="";for(let i=0;i<pdf.length;i+=8192)binary+=String.fromCharCode(...pdf.subarray(i,i+8192));
 const payload=JSON.stringify({action:"document_resubmission_save",issuedAt:Date.now(),nonce:crypto.randomUUID(),requestId:request.id,request,pdfBase64:btoa(binary)});
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signature=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload))))).split("+").join("-").split("/").join("_").replace(/=+$/,"");
 url.search="";url.hash="";url.searchParams.set("gf_document_bridge","resubmission_v1");
 const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({payload,signature}),redirect:"manual",signal:AbortSignal.timeout(45000)});
 let final=response;if([302,303].includes(response.status)){const location=new URL(response.headers.get("location")||"",url);if(location.origin!=="https://script.googleusercontent.com")throw new Error("bridge_redirect_invalid");final=await fetch(location,{method:"GET",redirect:"error",signal:AbortSignal.timeout(15000)});}
 if(!final.ok)throw new Error("bridge_failed");const result=await final.json();if(result.verified!==true||typeof result.fileId!=="string"||!/^[A-Za-z0-9_-]{10,200}$/.test(result.fileId))throw new Error("save_not_verified");return {fileId:result.fileId,reused:result.reused===true};
}

if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
if(req.method!=='POST'||req.headers.get('origin')!==origin)return reply({error:'Forbidden'},403);
try{
const raw=await req.text();if(raw.length>14500000)return reply({error:'Invalid request'},413);const b=JSON.parse(raw);if(typeof b.line_id_token!=='string'||b.line_id_token.length<100||b.line_id_token.length>8192)return reply({error:'Invalid request'},400);
const r=await fetch('https://api.line.me/oauth2/v2.1/verify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({id_token:b.line_id_token,client_id:'2012058414'}),signal:AbortSignal.timeout(10000)});
if(!r.ok)return reply({error:'LINE認証の有効期限が切れました'},401);
const line=await r.json();if(line.iss!=='https://access.line.me'||String(line.aud)!=='2012058414'||!/^U[0-9a-fA-F]{32}$/.test(String(line.sub))||!Number.isFinite(line.exp)||line.exp<=Date.now()/1000)return reply({error:'LINE認証が無効です'},401);
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:links,error:le}=await db.from('gf_line_auth_role_links').select('subject_id').eq('line_user_id',line.sub).eq('role_type','driver').eq('status','active').limit(2);
if(le||links?.length!==1)return reply({error:'ドライバーの承認が必要です'},403);
const driverId=links[0].subject_id;
const {data:driver,error:de}=await db.from('gf_driver_match_master_prod').select('driver_id').eq('driver_id',driverId).maybeSingle();
if(de||!driver)return reply({error:'ドライバー情報がありません'},404);
if(b.action==='document_requests_read'){
 const {data,error}=await db.from('gf_driver_document_review_requests')
   .select('id,document_type,reason,status').eq('driver_id',driverId)
   .in('status',['requested','submitted','approving']).order('created_at',{ascending:false}).limit(50);
 if(error)return reply({error:'書類の通知を取得できませんでした'},503);
 return reply({document_requests:(data||[]).map(x=>({...x,status:x.status==='approving'?'submitted':x.status})),document_upload_enabled:Deno.env.get('GF_DOCUMENT_RESUBMISSION_BRIDGE_ENABLED')==='YES'});
}
if(b.action==='document_resubmission_save'){
 if(Deno.env.get('GF_DOCUMENT_RESUBMISSION_BRIDGE_ENABLED')!=='YES')return reply({error:'再提出は準備中です'},503);
 if(typeof b.request_id!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(b.request_id)||typeof b.pdf_base64!=='string'||b.pdf_base64.length>13981016||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.pdf_base64))return reply({error:'Invalid request'},400);
 const {data:review,error:re}=await db.from('gf_driver_document_review_requests').select('id,receipt_id,driver_id,document_type,status').eq('id',b.request_id).eq('driver_id',driverId).maybeSingle();
 if(re||!review||review.status!=='requested')return reply({error:'再提出依頼を確認できません'},409);
 const {data:receipt,error:rr}=await db.from('gf_mypage_applications_prod').select('receipt_id,contract_status').eq('receipt_id',review.receipt_id).eq('driver_id',driverId).maybeSingle();
 if(rr||!receipt||['契約完了','契約締結済み','契約締結済'].includes(String(receipt.contract_status||'').trim()))return reply({error:'再提出対象外です'},409);
 if(!['driver_license','residence_certificate'].includes(review.document_type))return reply({error:'Invalid document'},400);
 const max=review.document_type==='residence_certificate'?4000000:10485760;
 if(b.pdf_base64.length>4*Math.ceil(max/3))return reply({error:'PDF容量超過'},413);
 let pdf:Uint8Array;
 try{pdf=Uint8Array.from(atob(b.pdf_base64),c=>c.charCodeAt(0));}catch{return reply({error:'Invalid PDF'},400);}
 if(pdf.length>max||new TextDecoder().decode(pdf.subarray(0,5))!=='%PDF-')return reply({error:'Invalid PDF'},400);
 const saved=await sendResubmission({id:review.id,receiptId:review.receipt_id,driverId,documentType:review.document_type,status:'requested',verified:true},pdf);
 const {data:attempt,error:recordError}=await db.rpc('gf_record_document_attempt',{p_request:review.id,p_driver:driverId,p_file:saved.fileId});
 if(recordError||!attempt)return reply({error:'提出結果を確認できません。再提出状況を更新してください'},409);
 return reply({status:'submitted'});
}
if(b.action!==undefined&&b.action!=='read')return reply({error:'Invalid action'},400);
const {data:apps,error:ae}=await db.from('gf_mypage_applications_prod').select('receipt_id,driver_id,received_at,reception_status,contract_status,contract_updated_at,delivery_wish,start_wish,updated_at').eq('driver_id',driverId).order('updated_at',{ascending:false}).order('receipt_id',{ascending:false}).limit(1);if(ae)return reply({error:'申込情報を取得できませんでした'},503);
const {data:vehicles,error:ve}=await db.from('gf_vehicles').select('vehicle_id,vehicle_number,vehicle_data').eq('vehicle_data->>DriverID',driverId).limit(15);
if(ve)return reply({error:'車両情報を取得できませんでした'},503);
const items=(vehicles||[]).map(v=>{const d=v.vehicle_data||{};const fields=['車種','カラー','区分/ステータス','車検満了日','名変予定日','名義変更日','引渡し','引渡可能日','納車予定日','管理区分'];const o:{[key:string]:unknown}={vehicle_id:v.vehicle_id,vehicle_number:v.vehicle_number,full_vehicle_number:[String(d['管轄']??'').trim(),String(d['車番']??v.vehicle_number??'').trim()||String(v.vehicle_number??'').trim()].filter(Boolean).join(' ')};for(const k of fields)o[k]=typeof d[k]==='string'?d[k]:'';return o;});
const app=apps?.[0]||null;
// Optional extension: preserve existing application display before schema rollout.
let detail:{application_area:string|null;application_email:string|null}={application_area:null,application_email:null};
if(app){
 const {data:extra,error:extraError}=await db.from('gf_mypage_applications_prod').select('application_area,application_email').eq('receipt_id',app.receipt_id).eq('driver_id',driverId).maybeSingle();
 if(!extraError&&extra)detail={application_area:extra.application_area??null,application_email:extra.application_email??null};
}
const contract=String(app?.contract_status||'').trim();
const signed=['契約締結済み','契約締結済','契約完了'].includes(contract);
let progress=null;
if(app&&signed){
  // Same already-authenticated LINE identity and driver ID. No new login or linking mechanism.
  const {data:rows,error:progressError}=await db.from('gf_driver_vehicle_progress')
    .select('vehicle_id,stage,stage_dates,delivery_available_date,delivery_confirmed_date')
    .eq('driver_id',driverId).limit(2);
  // Progress is optional and must not hide existing application details when temporarily unavailable.
  if(!progressError&&rows?.length===1&&items.some(v=>v.vehicle_id===rows[0].vehicle_id)){
    const entry=rows[0];
    if(['車両準備中','車両手配済み','名義変更前','名義変更中','名義変更済み'].includes(entry.stage)){
      progress={stage:entry.stage,stage_dates:entry.stage_dates||{},delivery_available_date:entry.delivery_available_date||null,delivery_confirmed_date:entry.delivery_confirmed_date||null};
    }
  }
}
const stage=app?(signed?(progress?.stage||'車両準備中'):'申込受付'):null;
// Notices are optional and never block existing driver information.
let notices:string[]=[];
try{
 const now=new Date().toISOString();
 const {data:noticeRows,error:noticeError}=await db.from('gf_driver_notices').select('body').eq('enabled',true).lte('starts_at',now).or('ends_at.is.null,ends_at.gt.'+now).order('starts_at',{ascending:false}).order('id',{ascending:false}).limit(10);
 if(!noticeError)notices=(noticeRows||[]).map(n=>String(n.body)).filter(Boolean);
}catch{/* optional feature */}
// Private document notices: identity is derived exclusively from verified LINE linkage.
let document_requests:unknown[]=[];
let document_requests_available=false;
try{
 const {data,error}=await db.from('gf_driver_document_review_requests').select('id,document_type,reason,status').eq('driver_id',driverId).in('status',['requested','submitted','approving']).order('created_at',{ascending:false}).limit(50);
 if(!error){document_requests=(data||[]).map(x=>({...x,status:x.status==='approving'?'submitted':x.status}));document_requests_available=true;}
}catch{/* existing vehicle information remains available */}
return reply({notices,document_requests,document_requests_available,vehicles:items,application:app?{
 receipt_id:app.receipt_id,received_at:app.received_at,reception_status:app.reception_status,
 contract_status:app.contract_status,contract_updated_at:app.contract_updated_at||null,
 delivery_wish:app.delivery_wish,start_wish:app.start_wish,
 application_area:detail.application_area,application_email:detail.application_email,
 stage,vehicle_progress:progress
}:null});
}catch{return reply({error:'通信エラーが発生しました'},503);}
});