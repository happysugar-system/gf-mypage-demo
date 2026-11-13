// GOLD FIRST isolated DEMO LINE login proof-of-concept.
// Deploy ONLY to a dedicated demo Supabase project after provider and data provenance checks.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const origin="https://happysugar-system.github.io";
const headers={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"};
const respond=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers});
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,"0")).join("");
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return respond(405,{error:"Method not allowed"});
 if(req.headers.get("Origin")!==origin)return respond(403,{error:"Origin denied"});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const channel=Deno.env.get("GF_DEMO_LINE_LOGIN_CHANNEL_ID");
 if(!url||!key||!channel)return respond(503,{error:"Demo is not configured"});
 const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const data=await req.json();
  if(data?.action==="begin"){
   const jwt=(req.headers.get("Authorization")||"").match(/^Bearer (\S+)$/)?.[1];
   if(!jwt)return respond(401,{error:"Sign in required"});
   const user=await sb.auth.getUser(jwt);
   if(user.error||!user.data.user?.email_confirmed_at)return respond(401,{error:"Verified sign-in required"});
   const uid=user.data.user.id;
   const recent=new Date(Date.now()-600000).toISOString();
   const rate=await sb.from("gf_demo_line_challenges").select("token_hash",{count:"exact",head:true}).eq("auth_user_id",uid).gte("created_at",recent);
   if(rate.error)return respond(503,{error:"Unavailable"});
   if((rate.count||0)>=3)return respond(429,{error:"Please try again later"});
   const bytes=crypto.getRandomValues(new Uint8Array(32));
   const token=btoa(String.fromCharCode(...bytes)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
   const ins=await sb.from("gf_demo_line_challenges").insert({token_hash:await hash(token),auth_user_id:uid,expires_at:new Date(Date.now()+300000).toISOString()});
   if(ins.error)return respond(503,{error:"Unavailable"});
   return respond(200,{challenge:token,expires_in_seconds:300});
  }
  if(data?.action==="complete"){
   if(typeof data.challenge!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(data.challenge)||typeof data.line_id_token!=="string"||data.line_id_token.length<100||data.line_id_token.length>8192)return respond(400,{error:"Invalid proof"});
   const verify=await fetch("https://api.line.me/oauth2/v2.1/verify",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({id_token:data.line_id_token,client_id:channel}),signal:AbortSignal.timeout(10000)});
   if(!verify.ok)return respond(401,{error:"LINE verification failed"});
   const line=await verify.json();
   if(line.iss!=="https://access.line.me"||String(line.aud)!==channel||typeof line.sub!=="string"||!/^U[0-9a-fA-F]{32}$/.test(line.sub)||!Number.isFinite(line.exp)||line.exp<=Date.now()/1000)return respond(401,{error:"Invalid LINE identity"});
   // The RPC locks the challenge, checks trusted demo-only identity mapping,
   // checks account conflicts, inserts the link and consumes the challenge atomically.
   // Only the server-side service role may execute the RPC.
   const linked=await sb.rpc("gf_demo_complete_line_challenge",{
    p_token_hash:await hash(data.challenge),p_line_user_id:line.sub
   });
   if(linked.error||linked.data!==true)return respond(409,{error:"本人確認できませんでした。デモ用の本人登録状況をご確認ください。"});
   return respond(200,{linked:true});
  }
  return respond(400,{error:"Unknown operation"});
 }catch{return respond(503,{error:"Demo verification unavailable"});}
});
