export function mountDriverNoticePanel(root,getSession){
 const endpoint="https://tgxrnrqxafytyqfwwsag.supabase.co/functions/v1/gf-driver-notice-admin-review";
 const el=(tag,label)=>{const n=document.createElement(tag);if(label)n.textContent=label;return n;};
 const form=el("form"),list=el("div"),msg=el("p"),body=el("textarea"),start=el("input"),end=el("input"),enabled=el("input"),save=el("button","保存"),reset=el("button","新規作成");
 let id=null;
 body.required=true;body.maxLength=1000;start.type=end.type="datetime-local";start.required=true;enabled.type="checkbox";reset.type="button";
 for(const [label,input] of [["お知らせ本文",body],["掲載開始日時（日本時間）",start],["掲載終了日時（任意・日本時間）",end],["掲載する",enabled]]){const l=el("label",label);l.append(input);form.append(l);}
 form.append(save,reset);root.replaceChildren(el("h2","お知らせ管理"),form,msg,list);
 const local=v=>v?new Date(Date.parse(v)+9*3600000).toISOString().slice(0,16):"";
 const clear=()=>{id=null;body.value="";start.value=local(new Date().toISOString());end.value="";enabled.checked=false;};
 async function call(data){const session=await getSession();if(!session?.access_token)throw Error("スタッフ認証が必要です");const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify(data)});const v=await r.json();if(!r.ok)throw Error(v.error||"通信エラー");return v;}
 async function refresh(){const data=await call({action:"list"});list.replaceChildren();for(const n of data.notices){const row=el("div"),edit=el("button","編集");edit.type="button";row.append(el("p",n.body),el("p",(n.enabled?"掲載設定ON":"非掲載")+" / "+local(n.starts_at)+" ～ "+local(n.ends_at)),edit);edit.onclick=()=>{id=n.id;body.value=n.body;start.value=local(n.starts_at);end.value=local(n.ends_at);enabled.checked=n.enabled;};list.append(row);}}
 reset.onclick=clear;form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await call({action:"save",id,body:body.value,starts_at:start.value+":00+09:00",ends_at:end.value?end.value+":00+09:00":null,enabled:enabled.checked});msg.textContent="保存しました";clear();await refresh();}catch(e){msg.textContent=e.message;}finally{save.disabled=false;}};
 clear();refresh().catch(e=>{msg.textContent=e.message;}); 
}
