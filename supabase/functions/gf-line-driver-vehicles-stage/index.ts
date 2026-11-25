import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
const origin='https://happysugar-system.github.io';
Deno.serve(async req=>{
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
if(req.method!=='POST'||req.headers.get('origin')!==origin)return reply({error:'Forbidden'},403);
try{
const b=await req.json();if(typeof b.line_id_token!=='string'||b.line_id_token.length<100||b.line_id_token.length>8192)return reply({error:'Invalid request'},400);
const r=await fetch('https://api.line.me/oauth2/v2.1/verify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({id_token:b.line_id_token,client_id:'2012058414'}),signal:AbortSignal.timeout(10000)});
if(!r.ok)return reply({error:'LINE認証の有効期限が切れました'},401);
const line=await r.json();if(line.iss!=='https://access.line.me'||String(line.aud)!=='2012058414'||!/^U[0-9a-fA-F]{32}$/.test(String(line.sub))||!Number.isFinite(line.exp)||line.exp<=Date.now()/1000)return reply({error:'LINE認証が無効です'},401);
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:links,error:le}=await db.from('gf_line_auth_role_links').select('subject_id').eq('line_user_id',line.sub).eq('role_type','driver').eq('status','active').limit(2);
if(le||links?.length!==1)return reply({error:'ドライバーの承認が必要です'},403);
const driverId=links[0].subject_id;
const {data:driver,error:de}=await db.from('gf_driver_match_master_prod').select('driver_id').eq('driver_id',driverId).maybeSingle();
if(de||!driver)return reply({error:'ドライバー情報がありません'},404);
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
return reply({vehicles:items,application:app?{
 receipt_id:app.receipt_id,received_at:app.received_at,reception_status:app.reception_status,
 contract_status:app.contract_status,contract_updated_at:app.contract_updated_at||null,
 delivery_wish:app.delivery_wish,start_wish:app.start_wish,
 application_area:detail.application_area,application_email:detail.application_email,
 stage,vehicle_progress:progress
}:null});
}catch{return reply({error:'通信エラーが発生しました'},503);}
});