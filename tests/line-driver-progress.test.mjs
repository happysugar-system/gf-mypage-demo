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
test('7段階の名称と納車可能日・確定日の表示がある',()=>{
  const names=['申込受付','契約締結','車両準備中','車両手配済み','名義変更前','名義変更中','名義変更済み'];
  for(const stage of names)assert.ok(html.includes("'"+stage+"'"),'missing stage '+stage);
  for(const label of ['納車可能日','納車確定日'])assert.ok(html.includes(label));
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

// Read-only regression checks.

test('公開LINE版の7段階表示と解除ボタンが配信されている',async()=>{
 const response=await fetch('https://happysugar-system.github.io/gf-mypage-demo/demo-line-identity-preview.html',{signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200);
 const live=await response.text();
 for(const text of ["'車両手配済み'","'名義変更前'","'名義変更中'","'名義変更済み'","gf-line-driver-demo-reset-stage"])
   assert.ok(live.includes(text),'public LINE page missing '+text);
});
test('車両取得APIは未認証呼び出しを拒否し、データを変えない',async()=>{
 const response=await fetch('https://tgxrnrqxafytyqfwwsag.supabase.co/functions/v1/gf-line-driver-vehicles-stage',{
  method:'POST',headers:{origin:'https://happysugar-system.github.io','content-type':'application/json'},
  body:JSON.stringify({line_id_token:'invalid'}),signal:AbortSignal.timeout(15000)
 });
 assert.equal(response.status,400);
});
