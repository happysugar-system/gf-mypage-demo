// Dedicated report workbook only. Never write to the authoritative ledger.
function GF_DELIVERY_reportRows_(result){
 const map=new Map(),details=[['対象月','区分','VehicleID','日付','実績受付ID','ドライバー名','車両ナンバー','車種','所属会社名','紹介元','稼働エリア']];
 function info(x){x=x||{};return [x['現在使用者']||'未記録',[x['管轄'],x['車番']].filter(Boolean).join(' ')||'未記録',...['車種','所属会社名','紹介元','稼働エリア'].map(k=>x[k]||'未記録')];}
 function month(k){if(!map.has(k))map.set(k,[k,0,0]);return map.get(k);}
 for(const m of result.planned.months){month(m.month)[1]=m.planned_count;for(const r of m.planned)details.push([m.month,'予定',r.id,r.date,'',...info(result.plannedInfo?.[r.id])]);}
 for(const m of result.actual.months){month(m.month)[2]=m.actual_count;for(const r of m.actual)details.push([m.month,'貸出開始実績（暫定）',result.details[r.id],r.date,r.id,...info(result.actualInfo?.[r.id])]);}
 if(result.planned.invalid.length+result.actual.invalid.length)throw Error('不正日付あり：集計出力を中止');
 return {summary:[['対象月','納車予定台数','貸出開始実績台数（暫定）'],...[...map.values()].sort((a,b)=>a[0].localeCompare(b[0]))],details:[details[0],...details.slice(1).sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1])||a[3].localeCompare(b[3]))]};
}
function GF_DELIVERY_generateReport(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw Error('集計実行中');
 try{
 const p=PropertiesService.getScriptProperties(),source=p.getProperty('GF_DELIVERY_SOURCE_BOOK_ID'),dest=p.getProperty('GF_DELIVERY_REPORT_BOOK_ID');
 if(!source||!dest||source===dest||p.getProperty('GF_DELIVERY_REPORT_ENABLE')!=='YES')throw Error('専用出力先・承認を確認してください');
 const src=SpreadsheetApp.openById(source),out=SpreadsheetApp.openById(dest);
 if(out.getSheetByName('車両台帳')||out.getSheetByName('ドライバーマスター'))throw Error('管理台帳への出力は禁止');
 const ledger=src.getSheetByName('車両台帳'),history=src.getSheetByName('実績履歴');
 if(!ledger||!history)throw Error('集計元不足');
 const rows=GF_DELIVERY_reportRows_(GF_DELIVERY_historyPreview_(ledger.getDataRange().getDisplayValues(),history.getDataRange().getDisplayValues()));
 const jobs=[['月別納車集計',rows.summary],['納車明細',rows.details]];
 // Only explicitly owned generated tabs may be refreshed.
 for(const [name] of jobs){const sh=out.getSheetByName(name);if(sh&&sh.getRange('A1').getNote()!=='GF_DELIVERY_GENERATED_V1')throw Error('既存シート保護: '+name);}
 for(const [name,data] of jobs){
 const sh=out.getSheetByName(name)||out.insertSheet(name);
 const old=sh.getLastRow();if(sh.getMaxRows()<data.length)sh.insertRowsAfter(sh.getMaxRows(),data.length-sh.getMaxRows());
 const safe=data.map(row=>row.map(v=>typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:v));
 sh.getRange(1,1,data.length,data[0].length).setValues(safe);
 if(old>data.length)sh.getRange(data.length+1,1,old-data.length,data[0].length).clearContent();
 sh.getRange('A1').setNote('GF_DELIVERY_GENERATED_V1');
 sh.getRange(1,1,1,data[0].length).setBackground('#166b56').setFontColor('#ffffff').setFontWeight('bold');
 sh.setFrozenRows(1);sh.autoResizeColumns(1,data[0].length);
 if(name==='納車明細'){const filter=sh.getFilter();if(filter)filter.remove();if(data.length>1)sh.getRange(1,1,data.length,data[0].length).createFilter();}
 }
 SpreadsheetApp.flush();return {months:rows.summary.length-1,details:rows.details.length-1};
 }finally{lock.releaseLock();}
}
