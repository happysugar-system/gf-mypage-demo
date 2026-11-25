// Standalone additive GAS module. Configure only in a staff-restricted deployment.
// Required script properties: GF_NOTICE_STAFF_EMAILS (comma separated), GF_NOTICE_SUPABASE_URL, GF_NOTICE_SERVICE_KEY.
function GF_NOTICE_guard_(){
 const p=PropertiesService.getScriptProperties();
 const email=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
 const allowed=String(p.getProperty('GF_NOTICE_STAFF_EMAILS')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!email||!allowed.includes(email))throw Error('スタッフ権限がありません');
 return p;
}
function GF_NOTICE_api_(method,query,body){
 const p=GF_NOTICE_guard_(),url=p.getProperty('GF_NOTICE_SUPABASE_URL'),key=p.getProperty('GF_NOTICE_SERVICE_KEY');
 if(!url||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)||!key)throw Error('接続設定がありません');
 const opt={method,headers:{apikey:key,Authorization:'Bearer '+key,Prefer:'return=representation'},muteHttpExceptions:true};
 if(body){opt.contentType='application/json';opt.payload=JSON.stringify(body);}
 const r=UrlFetchApp.fetch(url+'/rest/v1/gf_driver_notices'+query,opt);
 if(r.getResponseCode()<200||r.getResponseCode()>=300)throw Error('お知らせの通信に失敗しました');
 return JSON.parse(r.getContentText()||'[]');
}
function GF_NOTICE_list(){return GF_NOTICE_api_('get','?select=id,body,enabled,starts_at,ends_at&order=starts_at.desc,id.desc&limit=100');}
function GF_NOTICE_save(v){
 GF_NOTICE_guard_();
 if(!v||typeof v.body!=='string'||!v.body.trim()||v.body.trim().length>1000||typeof v.enabled!=='boolean')throw Error('入力内容を確認してください');
 const start=new Date(v.starts_at),end=v.ends_at?new Date(v.ends_at):null;
 if(!Number.isFinite(start.getTime())||(end&&(!Number.isFinite(end.getTime())||end<=start)))throw Error('掲載期間を確認してください');
 const body={body:v.body.trim(),enabled:v.enabled,starts_at:start.toISOString(),ends_at:end?end.toISOString():null};
 if(v.id!=null&&(!Number.isSafeInteger(v.id)||v.id<1))throw Error('IDが不正です');
 const rows=GF_NOTICE_api_(v.id?'patch':'post',v.id?'?id=eq.'+v.id:'',body);
 if(rows.length!==1)throw Error('保存結果を確認できません');
 return rows[0];
}
function GF_NOTICE_open(){GF_NOTICE_guard_();return HtmlService.createHtmlOutputFromFile('GF_DriverNoticeAdmin').setTitle('お知らせ管理');}
