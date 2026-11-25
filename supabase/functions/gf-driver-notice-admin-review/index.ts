import {createClient} from "npm:@supabase/supabase-js@2.95.0";
const ORIGIN="https://happysugar-system.github.io";
const CORS={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"};
const respond=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{...CORS,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
 if(req.method!=="POST")return respond(405,{error:"method_not_allowed"});
 if(req.headers.get("origin")!==ORIGIN){console.warn("gf_reception_access_denied","origin_not_allowed");return respond(403,{error:"origin_not_allowed"});}
 const bearer=req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
 if(!bearer)return respond(401,{error:"authentication_required"});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return respond(503,{error:"server_configuration_missing"});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authErr}=await db.auth.getUser(bearer);
 if(authErr||!user)return respond(401,{error:"invalid_session"});
 const email=(user.email||"").trim().toLowerCase();
 const {data:access,error:accessErr}=await db.from("gf_reception_access").select("email,role,enabled").eq("email",email).maybeSingle();
 if(accessErr)return respond(503,{error:"authorization_unavailable"});
 if(!access?.enabled){console.warn("gf_reception_access_denied","not_authorized");return respond(403,{error:"not_authorized"});}
 let input;try{input=await req.json()}catch{return respond(400,{error:"invalid_json"})}
 if(!["owner","staff"].includes(access.role))return respond(403,{error:"not_authorized"});
 if(input.action==="list"){
 const {data,error}=await db.from("gf_driver_notices").select("id,body,enabled,starts_at,ends_at").order("starts_at",{ascending:false}).limit(200);
 return error?respond(503,{error:"notices_unavailable"}):respond(200,{notices:data});
 }
 if(input.action!=="save")return respond(400,{error:"invalid_action"});
 const body=typeof input.body==="string"?input.body.trim():"";
 const starts=typeof input.starts_at==="string"?Date.parse(input.starts_at):NaN;
 const ends=input.ends_at==null||input.ends_at===""?null:Date.parse(input.ends_at);
 if(!body||body.length>1000||!Number.isFinite(starts)||(ends!==null&&(!Number.isFinite(ends)||ends<=starts))||typeof input.enabled!=="boolean")return respond(400,{error:"invalid_notice"});
 const row={body,enabled:input.enabled,starts_at:new Date(starts).toISOString(),ends_at:ends===null?null:new Date(ends).toISOString()};
 const id=input.id;
 if(id!=null&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id)))return respond(400,{error:"invalid_id"});
 const q=db.from("gf_driver_notices");
 const {data,error}=await (id==null?q.insert(row):q.update(row).eq("id",id)).select("id,body,enabled,starts_at,ends_at").single();
 return error?respond(503,{error:"notice_save_failed"}):respond(200,{notice:data});
});
