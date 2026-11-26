// Camera framing overlay. The caller supplies an authorized camera stream.
export function mountDocumentCaptureGuide(root, type, stream){
 if(!['driver_license','residence_certificate'].includes(type))throw Error('invalid_document');
 const license=type==='driver_license';
 const wrap=document.createElement('div');wrap.style.cssText='position:relative;width:100%;aspect-ratio:'+(license?'4/3':'3/4')+';background:#111;overflow:hidden;border-radius:12px';
 const video=document.createElement('video');video.autoplay=true;video.playsInline=true;video.muted=true;video.srcObject=stream;video.style.cssText='width:100%;height:100%;object-fit:contain';
 const frame=document.createElement('div');frame.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:82%;aspect-ratio:'+(license?'85.6/54':'210/297')+';border:3px solid #fff;box-sizing:border-box;box-shadow:0 0 0 100vmax rgba(0,0,0,.45);pointer-events:none';
 const label=document.createElement('p');label.textContent=license?'免許証の四隅を横長の枠に合わせ、文字が鮮明に映るようにしてください。':'住民票の四隅をA4の枠に合わせてください。提出にはスキャンしたPDFが必要です。';
 wrap.append(video,frame);root.append(wrap,label);
 return {video,frame,dispose(){video.srcObject=null;wrap.remove();label.remove();}};
}
