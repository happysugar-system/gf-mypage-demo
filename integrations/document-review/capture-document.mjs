// Capture exactly the visible guide area, accounting for object-fit:contain.
export function guideCrop(vw,vh,bw,bh,x,y,w,h){
 const scale=Math.min(bw/vw,bh/vh);
 if(!Number.isFinite(scale)||scale<=0)throw Error('camera_not_ready');
 const ox=(bw-vw*scale)/2,oy=(bh-vh*scale)/2;
 const sx=(x-ox)/scale,sy=(y-oy)/scale,sw=w/scale,sh=h/scale;
 if(sx<-.5||sy<-.5||sx+sw>vw+.5||sy+sh>vh+.5)throw Error('枠全体に書類が映るようにカメラを調整してください');
 return {sx:Math.max(0,sx),sy:Math.max(0,sy),sw:Math.min(sw,vw-Math.max(0,sx)),sh:Math.min(sh,vh-Math.max(0,sy))};
}
export async function captureDocument(video,frame,type){
 if(!['driver_license','residence_certificate'].includes(type))throw Error('invalid_document');
 const b=video.getBoundingClientRect(),f=frame.getBoundingClientRect();
 const c=guideCrop(video.videoWidth,video.videoHeight,b.width,b.height,f.left-b.left,f.top-b.top,f.width,f.height);
 const canvas=document.createElement('canvas');canvas.width=Math.round(c.sw);canvas.height=Math.round(c.sh);
 if(canvas.width<600||canvas.height<350)throw Error('解像度が不足しています。書類を鮮明に撮影してください');
 canvas.getContext('2d').drawImage(video,c.sx,c.sy,c.sw,c.sh,0,0,canvas.width,canvas.height);
 const jpeg=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('capture_failed')),'image/jpeg',.94));
 if(type==='driver_license')return new File([jpeg],'license.jpg',{type:'image/jpeg'});
 // The PDF is a camera scan, not proof of authenticity or legibility.
 const {PDFDocument}=await import('https://esm.sh/pdf-lib@1.17.1');
 const pdf=await PDFDocument.create(),page=pdf.addPage([595.28,841.89]);
 const image=await pdf.embedJpg(await jpeg.arrayBuffer());
 const scale=Math.min(595.28/image.width,841.89/image.height),w=image.width*scale,h=image.height*scale;
 page.drawImage(image,{x:(595.28-w)/2,y:(841.89-h)/2,width:w,height:h});
 return new File([await pdf.save()],'residence-certificate.pdf',{type:'application/pdf'});
}
export async function openDocumentCamera(){
 return navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1440}}});
}
export function closeDocumentCamera(stream){stream?.getTracks().forEach(t=>t.stop());}
