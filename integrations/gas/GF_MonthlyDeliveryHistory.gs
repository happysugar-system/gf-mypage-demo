// Read-only preview; source workbook is explicit and never modified.
function GF_DELIVERY_historyPreview_(ledger,history){
 const ix=(grid,n)=>{const h=grid[0].map(x=>String(x).trim());if(h.filter(x=>x===n).length!==1)throw Error('見出し不一致: '+n);return h.indexOf(n);};
 const v=ix(ledger,'VehicleID'),p=ix(ledger,'納車予定日');
 const rid=ix(history,'受付ID'),vid=ix(history,'VehicleID'),kind=ix(history,'種類'),day=ix(history,'実施日'),state=ix(history,'状態'),cancel=ix(history,'取消日時');
 const planned=GF_DELIVERY_monthlyPlan_([['ID','予定','実績'],...ledger.slice(1).map(r=>[r[v],r[p],''])],{id:'ID',planned:'予定',actual:'実績'});
 const plannedInfo=Object.create(null),actualInfo=Object.create(null);
 const fields=['現在使用者','管轄','車番','車種','所属会社名','紹介元','稼働エリア'];
 const indexes=fields.map(n=>ix(ledger,n));
 for(const r of ledger.slice(1)){const id=String(r[v]??'').trim();if(id)plannedInfo[id]=Object.fromEntries(fields.map((n,i)=>[n,String(r[indexes[i]]??'')]));}
 const after=ix(history,'変更後JSON');
 const events=new Set(),rows=[['ID','予定','実績']],details={};
 for(const r of history.slice(1)){if(r[kind]!=='貸出開始'||r[state]!=='完了'||r[cancel])continue;const id=String(r[rid]||'').trim(),vehicle=String(r[vid]||'').trim();if(!id||!vehicle||!r[day])throw Error('実績識別情報不足');if(events.has(id))throw Error('実績受付ID重複');events.add(id);rows.push([id,'',r[day]]);details[id]=vehicle;let snap={};try{const x=JSON.parse(r[after]);if(x&&typeof x==='object'&&!Array.isArray(x))snap=x;}catch{} actualInfo[id]=Object.fromEntries(fields.map(n=>[n,typeof snap[n]==='string'?snap[n]:'']));}
 const actual=GF_DELIVERY_monthlyPlan_(rows,{id:'ID',planned:'予定',actual:'実績'});
 return {planned,actual,details,plannedInfo,actualInfo,definition:'貸出開始・完了・取消なし（納車実績候補）'};
}
function GF_DELIVERY_preview(){
 const id=PropertiesService.getScriptProperties().getProperty('GF_DELIVERY_SOURCE_BOOK_ID');
 if(!id)throw Error('集計元未設定');
 const book=SpreadsheetApp.openById(id),ledger=book.getSheetByName('車両台帳'),history=book.getSheetByName('実績履歴');
 if(!ledger||!history)throw Error('集計元シート不足');
 const result=GF_DELIVERY_historyPreview_(ledger.getDataRange().getDisplayValues(),history.getDataRange().getDisplayValues());
 return {planned:result.planned.months.map(m=>({month:m.month,count:m.planned_count})),actual:result.actual.months.map(m=>({month:m.month,count:m.actual_count})),invalid:result.planned.invalid.length+result.actual.invalid.length,definition:result.definition};
}
