// Server-only transport. Caller must resolve ownership and request state from DB.
export type VerifiedRequest = {id:string; receiptId:string; driverId:string; documentType:"driver_license"|"residence_certificate"; status:"requested"; verified:true};
export async function sendResubmission(request:VerifiedRequest, pdf:Uint8Array) {
 if(Deno.env.get("GF_DOCUMENT_RESUBMISSION_BRIDGE_ENABLED")!=="YES")throw new Error("bridge_disabled");
 const secret=Deno.env.get("GF_DOCUMENT_BRIDGE_SECRET")||"";
 const url=new URL(Deno.env.get("GF_DOCUMENT_RESUBMISSION_BRIDGE_URL")||"");
 if(secret.length<32||url.origin!=="https://script.google.com"||!/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname)||url.username||url.password)throw new Error("bridge_config_invalid");
 if(request.status!=="requested"||request.verified!==true||!request.driverId||!request.receiptId||!["driver_license","residence_certificate"].includes(request.documentType))throw new Error("request_not_verified");
 const max=request.documentType==="residence_certificate"?4000000:10485760;
 if(pdf.length<5||pdf.length>max||new TextDecoder().decode(pdf.subarray(0,5))!=="%PDF-")throw new Error("invalid_pdf");
 let binary="";
 for(let i=0;i<pdf.length;i+=8192)binary+=String.fromCharCode(...pdf.subarray(i,i+8192));
 const payload=JSON.stringify({action:"document_resubmission_save",issuedAt:Date.now(),nonce:crypto.randomUUID(),requestId:request.id,request,pdfBase64:btoa(binary)});
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signature=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload))))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
 url.search="";url.hash="";url.searchParams.set("gf_document_bridge","resubmission_v1");
 const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({payload,signature}),redirect:"manual",signal:AbortSignal.timeout(45000)});
 let final=response;
 if([302,303].includes(response.status)){
  const location=new URL(response.headers.get("location")||"",url);
  if(location.origin!=="https://script.googleusercontent.com")throw new Error("bridge_redirect_invalid");
  final=await fetch(location,{method:"GET",redirect:"error",signal:AbortSignal.timeout(15000)});
 }
 if(!final.ok)throw new Error("bridge_failed");
 const result=await final.json();
 if(result.verified!==true||typeof result.fileId!=="string"||!/^[\w-]{10,200}$/.test(result.fileId))throw new Error("save_not_verified");
 return {fileId:result.fileId,reused:result.reused===true};
}
