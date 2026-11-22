import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function runPage(data){
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',style:{},children:[],replaceChildren(){this.children=[]},append(el){this.children.push(el)}});return nodes.get(id)};
  const document={createElement(tag){return {tag,textContent:'',className:'',style:{},children:[],append(...x){this.children.push(...x)}}}};
  const match=html.match(/function showPage\(d\)\{[\s\S]*?\n\}\n\n\/\*\*/);
  assert.ok(match,'showPage function must be present');
  const context={document,$:node,showOnly(id){node('currentPage').textContent=id}};
  vm.runInNewContext(match[0].slice(0,match[0].lastIndexOf('/**'))+'\nshowPage(payload)',{...context,payload:data});
  return {nodes,steps:node('steps').children};
}
const basic={driverId:'D999999',receipt:'TEST',stage:'申込受付',contract:'未送信'};
test('車両進捗なしでも申込受付・契約締結を含む7段階が表示される',()=>{
 const {steps}=runPage(basic);
 assert.deepEqual(steps.map(x=>x.children[1].textContent),['申込受付','契約締結','車両準備中','車両手配済み','名義変更前','名義変更中','名義変更済み']);
 assert.match(steps[0].className,/current/);
});
test('車両進捗ありで契約締結が消えず、名義変更中が現在位置になる',()=>{
 const {steps}=runPage({...basic,stage:'車両準備中',vehicleStage:'名義変更中',progressDates:{'名義変更中':'2026-11-22T00:00:00Z'}});
 assert.match(steps[5].className,/current/);
 assert.match(steps[1].className,/done/);
 assert.equal(steps[5].children[2].textContent,'2026/11/22');
});
test('納車可能日と確定日を別々に表示する',()=>{
 const {nodes}=runPage({...basic,deliveryAvailableDate:'2026-12-01',deliveryConfirmedDate:'2026-12-03'});
 assert.equal(nodes.get('deliveryAvailableDate').textContent,'2026-12-01');
 assert.equal(nodes.get('deliveryConfirmedDate').textContent,'2026-12-03');
});
test('本人の進捗情報だけをRLS保護テーブルから取得する',()=>{
 assert.match(html, /\.from\('gf_driver_vehicle_progress'\)/);
 assert.match(html, /\.eq\('driver_id',link\.driver_id\)/);
 assert.match(html, /vehicleStage: completedStatuses\.includes\(contractStatus\)/);
});
test('旧表示を7段階に変換できる',()=>{
 const {steps}=runPage({...basic,stage:'名義変更'});
 assert.match(steps[5].className,/current/);
});

test('進捗取得に失敗しても既存申込表示を継続する',()=>{
 assert.match(html, /if\(progressError\) console\.warn/);
 assert.match(html, /progressError \? null : \(progressRows\?\.\[0\] \|\| null\)/);
 assert.doesNotMatch(html, /if\(progressError\) throw progressError/);
});
