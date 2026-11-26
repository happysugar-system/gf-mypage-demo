import {mountDocumentCaptureGuide} from './capture-guide.mjs';
import {openDocumentCamera,closeDocumentCamera,captureDocument} from './capture-document.mjs';
export function mountDocumentUpload(root,request,submit){
 if(!request||request.status!=='requested'||!['driver_license','residence_certificate'].includes(request.document_type))throw Error('invalid_request');
 const type=request.document_type,license=type==='driver_license';
 let stream,guide,file,url,closed=false,busy=false,seq=0,front=null;
 const el=(tag,label)=>{const e=document.createElement(tag);if(label)e.textContent=label;return e;};
 const title=el('h3',license?'免許証の再提出':'住民票の再提出'),camera=el('button','カメラで撮影'),take=el('button','撮影する'),pick=el('input'),preview=el('div'),host=el('div'),message=el('p'),send=el('button','書類を提出する'),cancel=el('button','閉じる');
 for(const b of [camera,take,send,cancel])b.type='button';
 pick.type='file';pick.accept='application/pdf';take.hidden=true;send.disabled=true;message.setAttribute('role','status');
 function stop(){seq++;guide?.dispose();guide=null;closeDocumentCamera(stream);stream=null;take.hidden=true;}
 function clear(){if(url)URL.revokeObjectURL(url);url=null;file=null;preview.replaceChildren();send.disabled=true;}
 function select(f){clear();if(!f)return;if(!(license?['image/jpeg','image/png','application/pdf']:['application/pdf']).includes(f.type)||f.size>(license?10*1024*1024:4000000)||!f.size)throw Error('対応形式・容量のファイルを選択してください（住民票4MB以内、免許証10MB以内）');file=f;url=URL.createObjectURL(f);const p=el('p',f.name);preview.append(p);if(f.type.startsWith('image/')){const img=el('img');img.src=url;img.alt='撮影した書類';img.style.maxWidth='100%';preview.append(img);}else{const link=el('a','PDFを確認する');link.href=url;link.target='_blank';link.rel='noopener noreferrer';preview.append(link);}send.disabled=false;}
 camera.onclick=async()=>{if(busy)return;stop();clear();const token=seq;try{const s=await openDocumentCamera();if(closed||token!==seq){closeDocumentCamera(s);return;}stream=s;guide=mountDocumentCaptureGuide(host,type,stream);take.hidden=false;message.textContent=license?(front?'免許証の裏面を枠に合わせてください':'免許証の表面を枠に合わせてください'):'枠に書類を合わせてください';}catch{message.textContent='カメラを起動できません。ファイル選択をご利用ください。';}};
 take.onclick=async()=>{if(!guide||busy)return;busy=true;const token=seq;try{const f=await captureDocument(guide.video,guide.frame,type);if(!closed&&token===seq){if(license&&!front){front=f;message.textContent='表面を撮影しました。裏面を枠に合わせて撮影してください。';return;}let output=f;if(license){const {PDFDocument}=await import('https://esm.sh/pdf-lib@1.17.1');const pdf=await PDFDocument.create();for(const side of [front,f]){const img=await pdf.embedJpg(await side.arrayBuffer());const page=pdf.addPage([595.28,841.89]);const scale=Math.min(500/img.width,700/img.height);const w=img.width*scale,h=img.height*scale;page.drawImage(img,{x:(595.28-w)/2,y:(841.89-h)/2,width:w,height:h});}output=new File([await pdf.save()],'license-front-back.pdf',{type:'application/pdf'});front=null;}if(closed||token!==seq)return;stop();select(output);message.textContent='内容を確認してください。撮り直しもできます。';}}catch(e){message.textContent=e.message;}finally{busy=false;}};
 pick.onchange=()=>{if(busy)return;front=null;stop();try{select(pick.files[0]);message.textContent='内容を確認してください';}catch(e){message.textContent=e.message;}pick.value='';};
 send.onclick=async()=>{if(!file||busy||typeof submit!=='function')return;busy=true;send.disabled=true;camera.disabled=pick.disabled=cancel.disabled=true;try{const result=await submit(request.id,file);if(result?.status!=='submitted')throw Error('提出結果を確認できませんでした');clear();stop();message.textContent='再提出済み・スタッフ確認待ち';camera.disabled=pick.disabled=true;}catch(e){message.textContent=e.message;send.disabled=false;camera.disabled=pick.disabled=false;}finally{busy=false;cancel.disabled=false;}};
 if(typeof submit!=='function'){send.hidden=true;message.textContent='検証用：撮影と確認のみ。送信はまだできません。';}
 const dispose=()=>{closed=true;front=null;stop();clear();root.replaceChildren();};cancel.onclick=dispose;
 root.replaceChildren(title,camera,pick,host,take,preview,message,send,cancel);return dispose;
}
