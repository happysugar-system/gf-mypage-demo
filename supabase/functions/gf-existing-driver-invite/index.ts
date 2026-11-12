// Existing GF drivers: staff-issued, one-time private account invitation.
// The original license image is never exposed; invitation delivery must
// be through a trusted, privately verified driver contact channel.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const origin="https://happysugar-system.github.io";
const headers={
  "Access-Control-Allow-Origin":origin,
  "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Content-Type":"application/json",
  "Cache-Control":"no-store",
  "Vary":"Origin"
};
const respond=(status:number,data:Record<string,unknown>)=>
  new Response(JSON.stringify(data),{status,headers});
const hash=async(value:string)=>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))]
    .map(x=>x.toString(16).padStart(2,"0")).join("");

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers});
  if(req.method!=="POST")return respond(405,{error:"Method not allowed"});
  if(req.headers.get("Origin")!==origin)
    return respond(403,{error:"Forbidden"});
  const url=Deno.env.get("SUPABASE_URL");
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return respond(503,{error:"Not configured"});
  try{
    const jwt=(req.headers.get("Authorization")||"")
      .match(/^Bearer ([A-Za-z0-9_.-]{100,8192})$/)?.[1];
    if(!jwt)return respond(401,{error:"Login required"});
    const supabase=createClient(url,key,{
      auth:{persistSession:false,autoRefreshToken:false}
    });
    const {data:{user},error:userErr}=await supabase.auth.getUser(jwt);
    if(userErr||!user?.id||!user.email_confirmed_at)
      return respond(401,{error:"Verified login required"});
    const body=await req.json().catch(()=>null);
    if(!body||typeof body!=="object")
      return respond(400,{error:"Invalid request"});

    if(body.action==="issue"){
      const {count:adminCount,error:adminErr}=await supabase
        .from("gf_mypage_admins")
        .select("auth_user_id",{head:true,count:"exact"})
        .eq("auth_user_id",user.id);
      if(adminErr||adminCount!==1)return respond(403,{error:"Administrator required"});
      const driverId=String(body.driver_id||"").trim();
      if(!/^D[0-9]{6}$/.test(driverId))
        return respond(400,{error:"Invalid DriverID"});
      const {data:drivers,error:dError}=await supabase
        .from("gf_driver_match_master_prod").select("driver_id,full_name")
        .eq("driver_id",driverId).limit(2);
      if(dError||drivers?.length!==1||!drivers[0].full_name?.trim())
        return respond(404,{error:"Driver record unavailable"});
      const {data:existing,error:lError}=await supabase
        .from("gf_mypage_links").select("id").eq("driver_id",driverId).limit(1);
      if(lError||existing?.length)
        return respond(409,{error:"This driver is already linked"});
      const random=crypto.getRandomValues(new Uint8Array(32));
      const invite=btoa(String.fromCharCode(...random))
        .replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
      const codeHash=await hash(invite);
      // Reissue invalidates any prior unused invitations for the same DriverID.
      const {error:expireError}=await supabase
        .from("gf_mypage_existing_driver_invites")
        .update({expires_at:new Date().toISOString()})
        .eq("driver_id",driverId).is("redeemed_at",null)
        .gt("expires_at",new Date().toISOString());
      if(expireError)return respond(503,{error:"Could not issue invitation"});
      const expires=new Date(Date.now()+7*24*60*60*1000).toISOString();
      const {error:insertError}=await supabase
        .from("gf_mypage_existing_driver_invites")
        .insert({code_hash:codeHash,driver_id:driverId,
                 issued_by:user.id,expires_at:expires});
      if(insertError)return respond(503,{error:"Could not issue invitation"});
      // Code is returned once. It is never stored in plaintext in Supabase.
      return respond(200,{invite_code:invite,expires_at:expires});
    }

    if(body.action==="redeem"){
      const invite=String(body.invite_code||"").trim();
      if(!/^[A-Za-z0-9_-]{43}$/.test(invite))
        return respond(400,{error:"招待コードの形式が正しくありません"});
      const codeHash=await hash(invite);
      const {data:linked,error:linkError}=await supabase.rpc(
        "gf_redeem_existing_driver_invite",
        {p_auth_user_id:user.id,p_code_hash:codeHash}
      );
      if(linkError||linked!==true)
        return respond(409,{error:"招待コードを確認できませんでした。期限または本人情報をご確認ください。"});
      return respond(200,{linked:true});
    }
    return respond(400,{error:"Unknown operation"});
  }catch(_error){
    return respond(503,{error:"お手続きを完了できませんでした。"});
  }
});
