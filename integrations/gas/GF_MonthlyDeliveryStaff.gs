// Staff-only read view. Uses the notice module's fail-closed staff guard.
function GF_DELIVERY_staffData(){
 const p=GF_NOTICE_guard_();
 const id=p.getProperty('GF_DELIVERY_SOURCE_BOOK_ID');if(!id)throw Error('集計元未設定');
 const b=SpreadsheetApp.openById(id),l=b.getSheetByName('車両台帳'),h=b.getSheetByName('実績履歴');
 if(!l||!h)throw Error('集計元不足');
 return GF_DELIVERY_reportRows_(GF_DELIVERY_historyPreview_(l.getDataRange().getDisplayValues(),h.getDataRange().getDisplayValues()));
}
function GF_DELIVERY_open(){GF_NOTICE_guard_();return HtmlService.createHtmlOutputFromFile('GF_MonthlyDeliveryStaff').setTitle('月別納車管理');}
