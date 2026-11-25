// Additive router for the existing staff deployment. Call only from its authenticated route.
function GF_STAFF_extraPage_(page){
  GF_NOTICE_guard_();
  switch(page){
    case 'driver-notices': return GF_NOTICE_open();
    case 'monthly-delivery': return GF_DELIVERY_open();
    default: throw Error('対象外の画面です');
  }
}
function GF_STAFF_extraMenu_(){
  GF_NOTICE_guard_();
  return [{page:'driver-notices',label:'お知らせ管理'},{page:'monthly-delivery',label:'月別納車管理'}];
}
