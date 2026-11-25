import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../demo-line-identity-preview.html',import.meta.url),'utf8');
const api=readFileSync(new URL('../supabase/functions/gf-line-driver-vehicles-stage/index.ts',import.meta.url),'utf8');

test('既存LINE画面のJavaScript構文に問題がない',()=>{
  const blocks=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(Boolean);
  assert.ok(blocks.length>0);
  for(const block of blocks)new vm.Script(block);
});
test('LINE氏名登録・任意の電話メール・登録状況の流れを保持する',()=>{
  for(const fragment of ['id="driverName" required','id="driverPhone" maxlength','id="driverEmail" type="email"','gf-line-first-driver-status-stage','gf_line_auth_role_links']) {
    assert.ok(html.includes(fragment)||api.includes(fragment),'missing '+fragment);
  }
  assert.ok(html.includes('LINEと連携して登録する'));
  assert.ok(!html.includes('メール認証でログイン'));
});
test('テスト用紐づけ解除と初回登録へ戻す機能を維持する',()=>{
  for(const fragment of ['id="demoResetArea"','id="demoResetDriver"','gf-line-driver-demo-reset-stage','reset_demo_driver_link','RESET_DEMO_DRIVER_LINK'])assert.ok(html.includes(fragment));
  assert.ok(html.includes('location.replace(location.origin+location.pathname'));
});
test('7段階の名称と納車予定日・確定日の表示がある',()=>{
  const names=['申込受付','契約締結','車両準備中','車両手配済み','名義変更前','名義変更中','名義変更済み'];
  for(const stage of names)assert.ok(html.includes("'"+stage+"'"),'missing stage '+stage);
  for(const label of ['納車予定日','納車確定日'])assert.ok(html.includes(label));
  for(const column of ['delivery_available_date','delivery_confirmed_date','stage_dates'])assert.ok(html.includes(column)&&api.includes(column));
});
test('LINEの承認済みのDriverIDから本人の進捗だけ取得する',()=>{
  assert.ok(api.includes(".eq('line_user_id',line.sub)"));
  assert.ok(api.includes(".eq('status','active')"));
  assert.ok(api.includes('const driverId=links[0].subject_id;'));
  assert.ok(api.includes(".eq('driver_id',driverId).limit(2)"));
  assert.ok(api.includes("items.some(v=>v.vehicle_id===rows[0].vehicle_id)"));
  assert.ok(api.includes("const signed=['契約締結済み','契約締結済','契約完了'].includes(contract)"));
});
test('既存申込と車両台帳は読み取りのみで、既存情報も表示し続ける',()=>{
  assert.ok(api.includes('gf_mypage_applications_prod'));
  assert.ok(api.includes("db.from('gf_vehicles')"));
  assert.ok(api.includes('vehicle_progress:progress'));
  assert.ok(!api.includes('.upsert('));
  assert.ok(!api.includes('.delete('));
  assert.ok(!api.includes('.update('));
});

test('納車予定日・確定日は日本語表示で、未定の場合も崩れない',()=>{
 const start=html.indexOf('const rawDate=a.vehicle_progress?.[key]');
 const end=html.indexOf("val.style.cssText=",start);
 assert.ok(start>0&&end>start);
 const expression=html.slice(start,end);
 const render=new Function('a','key','val',expression);
 for(const [raw,want] of [['2026-12-01','2026年12月1日'],['2026-02-09','2026年2月9日'],['','未定']]){
  const val={textContent:''};
  render({vehicle_progress:{delivery_available_date:raw}},'delivery_available_date',val);
  assert.equal(val.textContent,want);
 }
});
test('LINE版APIとスタッフ画面は納車日2種類を同じ保存キーでやり取りする',()=>{
 for(const field of ['delivery_available_date','delivery_confirmed_date']){
  assert.ok(api.includes(field),'LINE API missing '+field);
  assert.ok(html.includes(field),'MyPage missing '+field);
 }
 assert.match(api,/\.eq\('driver_id',driverId\)\.limit\(2\)/);
 assert.match(api,/items\.some\(v=>v\.vehicle_id===rows\[0\]\.vehicle_id\)/);
 assert.match(api,/let progress=null;/);
});

test('納車予定日の表示変更は既存保存キーを維持する',()=>{
 assert.ok(html.includes("['納車予定日','delivery_available_date']"));
 assert.ok(!html.includes("['納車可能日','delivery_available_date']"));
});
