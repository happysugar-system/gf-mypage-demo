// Read-only aggregation from the authoritative vehicle ledger. No triggers or sheet writes.
function GF_DELIVERY_monthlyPlan_(grid, columns){
 const heads=grid[0].map(v=>String(v).trim());
 const idx={};for(const k of ['id','planned','actual']){const n=columns[k];if(!n||heads.filter(h=>h===n).length!==1)throw Error('集計列未確定・重複: '+k);idx[k]=heads.indexOf(n);}
 if(new Set(Object.values(idx)).size!==3)throw Error('予定日と実績日は別列が必要です');
 const seen=new Set(),months=new Map(),invalid=[];
 function month(v){if(v===''||v==null)return null;const s=String(v).trim(),m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);if(!m)return false;const y=+m[1],mo=+m[2],d=+m[3],t=new Date(Date.UTC(y,mo-1,d));return t.getUTCFullYear()===y&&t.getUTCMonth()===mo-1&&t.getUTCDate()===d?m[1]+'-'+String(mo).padStart(2,'0'):false;}
 for(const row of grid.slice(1)){const id=String(row[idx.id]??'').trim();if(!id)continue;if(seen.has(id))throw Error('車両ID重複');seen.add(id);
 for(const type of ['planned','actual']){const raw=row[idx[type]],key=month(raw);if(key===false){invalid.push({id,type});continue;}if(!key)continue;if(!months.has(key))months.set(key,{month:key,planned:[],actual:[]});months.get(key)[type].push({id,date:String(raw)});}
 }
 return {months:[...months.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(m=>({...m,planned_count:m.planned.length,actual_count:m.actual.length})),invalid};
}
