import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {DEMO_SESSION_KEY, parseDemoSession, readDemoSession, saveDemoSession, toKopiykas, toMinor} from './expense-session.ts';
const item={id:1,counterparty:'Тестова оренда',category:'Оренда',project:'Амбулаторія' as const,amount:20000,due:'2026-11-30',bank:'Тестовий банк',status:'planned' as const,paid:0,note:''};
const session=()=>({version:1 as const,items:[item],pending:[]});
const storage=()=>{const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)}};};
test('money input preserves exact kopecks and rejects fractions',()=>{
 assert.equal(toKopiykas('8000,25'),800025);
 assert.equal(toKopiykas('0.01'),1);
 assert.equal(toKopiykas('20000'),2000000);
 assert.throws(()=>toKopiykas('12.345'),/двома/);
 assert.throws(()=>toKopiykas('-12'),/двома/);
 assert.throws(()=>toKopiykas('1e3'),/двома/);
 assert.equal(toMinor(8000.25),800025);
 assert.throws(()=>toMinor(0.005),/двох/);
});
test('demo session survives a full re-read through storage',()=>{
 const st=storage();
 assert.equal(readDemoSession(st),null);
 saveDemoSession(st,session());
 assert.deepEqual(readDemoSession(st),session());
});
test('an overpayment is rejected before saving',()=>{
 const st=storage();saveDemoSession(st,session());
 const raw=st.getItem(DEMO_SESSION_KEY);
 assert.throws(()=>saveDemoSession(st,{...session(),items:[{...item,paid:20001}]}),/перевищувати/);
 assert.equal(st.getItem(DEMO_SESSION_KEY),raw);
});
test('pending payments cannot exceed outstanding balance',()=>{
 const st=storage();
 assert.throws(()=>saveDemoSession(st,{...session(),pending:[{id:1,obligationId:1,amount:20001,date:'2026-11-11',bank:'Тестовий',note:''}]}),/перевищують/);
});
test('unknown versions are not erased',()=>{
 const st=storage();
 st.setItem(DEMO_SESSION_KEY,JSON.stringify({...session(),version:2}));
 assert.throws(()=>saveDemoSession(st,session()),/Невідома версія/);
 assert.equal(JSON.parse(st.getItem(DEMO_SESSION_KEY)!).version,2);
});
test('invalid JSON is retained',()=>{
 const st=storage();st.setItem(DEMO_SESSION_KEY,'{corrupt');
 assert.throws(()=>readDemoSession(st),/пошкоджені/);
 assert.equal(st.getItem(DEMO_SESSION_KEY),'{corrupt');
});
test('duplicates and orphan pending records are refused',()=>{
 assert.throws(()=>parseDemoSession({...session(),items:[item,item]}),/Повторний/);
 assert.throws(()=>parseDemoSession({...session(),pending:[{id:1,obligationId:99,date:'2026-11-11',bank:'Тест',note:'',amount:10}]}),/без зобов’язання/);
});
test('invalid calendar dates are rejected',()=>assert.throws(()=>parseDemoSession({...session(),items:[{...item,due:'2026-02-30'}]}),/дата/));
