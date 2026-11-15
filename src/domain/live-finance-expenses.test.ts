import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {parseLiveFinanceExpenses,loadReadOnlyFinanceExpenses} from './live-finance-expenses.ts';
const bill={id:'ledger-1',project:'ambulatory',currency:'UAH',amountMinor:'250000',paidMinor:'50000',remainingMinor:'200000',dueDate:'2026-11-12',title:'Сервіс',category:'Програмне забезпечення',plannedBank:'Банк',note:'',payments:[]};
test('live PostgreSQL obligations are read-only modelled for existing Figma table',()=>{
 const [row]=parseLiveFinanceExpenses({records:[bill]},'2026-11-15');
 assert.equal(row.serverId,'ledger-1');assert.equal(row.project,'Амбулаторія');assert.equal(row.amount,2500);
 assert.equal(row.paid,500);assert.equal(row.status,'partial');assert.equal(row.category,'Програмне забезпечення');
});
test('live financial KPI fails closed for unsupported currency, rounding, missing records, truncated result and duplicate IDs',()=>{
 assert.throws(()=>parseLiveFinanceExpenses({records:[{...bill,currency:'USD'}]},'2026-11-15'),/валюти/);
 assert.throws(()=>parseLiveFinanceExpenses({records:[{...bill,amountMinor:'9007199254740993'}]},'2026-11-15'),/точність/);
 assert.throws(()=>parseLiveFinanceExpenses({records:[{...bill,remainingMinor:'wrong'}]},'2026-11-15'),/залишок/);
 assert.throws(()=>parseLiveFinanceExpenses({records:[bill,bill]},'2026-11-15'),/ID/);
 assert.throws(()=>parseLiveFinanceExpenses({records:Array.from({length:500},()=>bill)},'2026-11-15'),/посторінкового/);
});
test('live read requires a valid private session and never silently returns synthetic demo data',async()=>{
 let calls:string[]=[];
 const f=async(url:string,init:RequestInit)=>{calls.push(url);assert.equal(init.credentials,'same-origin');return new Response(JSON.stringify(url.endsWith('/session')?{authenticated:true}:{records:[bill]}),{status:200});};
 const rows=await loadReadOnlyFinanceExpenses({fetcher:f,today:'2026-11-15'});
 assert.equal(rows.length,1);assert.deepEqual(calls,['/finance-api/session','/finance-api/obligations']);
 calls=[];
 await assert.rejects(()=>loadReadOnlyFinanceExpenses({fetcher:async(url)=>new Response(JSON.stringify(url.endsWith('/session')?{authenticated:false}:{records:[bill]})),today:'2026-11-15'}),/вхід/);
});
