import {useEffect,useState,type FormEvent} from 'react';
import {financeServer,parseMoney,showMinor,type ServerBill} from './domain/server-expenses-api';
const projects={ambulatory:'Амбулаторія',screening:'Скринінг',psychotherapy:'Психотерапія',personal:'Особисті'};
type P=keyof typeof projects;
export default function ServerExpenses() {
 const [rows,setRows]=useState<ServerBill[]>([]);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(true);
 const [title,setTitle]=useState('');
 const [category,setCategory]=useState('Оренда');
 const [project,setProject]=useState<P>('ambulatory');
 const [amount,setAmount]=useState('');
 const [due,setDue]=useState('2026-12-01');
 const [target,setTarget]=useState<ServerBill|null>(null);
 const [payment,setPayment]=useState('');
 async function refresh(){
  setBusy(true);
  try{setRows(await financeServer.list());setError('');}
  catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }
 useEffect(()=>{void refresh();},[]);
 async function create(e:FormEvent){
  e.preventDefault();setBusy(true);
  try{await financeServer.create({project,title,category,plannedBank:'Тестовий рахунок',note:'Демо',dueDate:due,amountMinor:parseMoney(amount)});setTitle('');setAmount('');await refresh();}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function prepare(e:FormEvent){
  e.preventDefault();if(!target)return;setBusy(true);
  try{
   const amountMinor=parseMoney(payment);
   const queued=target.payments.filter(p=>p.state==='submitted'||p.state==='planned').reduce((sum,p)=>sum+BigInt(p.amountMinor),0n);
   if(BigInt(amountMinor)+queued>BigInt(target.remainingMinor))throw Error('Платіж перевищує залишок із урахуванням черги');
   await financeServer.pending(target.id,target.currency,amountMinor);
   setTarget(null);setPayment('');await refresh();
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <>
  <div className="expenses-notice"><strong>ТЕСТ СЕРВЕРНОЇ БАЗИ.</strong> Лише вигадані дані. Платіж без банківського підтвердження не зменшує борг. Реальні фінанси сюди не вводити.</div>
  <div className="table-card" style={{padding:20}}>
   <h2>Витрати та зобов'язання · PostgreSQL</h2>
   {error&&<p role="alert" style={{color:'firebrick'}}>{error}</p>}
   <button className="secondary" type="button" disabled={busy} onClick={()=>void refresh()}>Оновити записи</button>
   <form onSubmit={create} style={{display:'grid',gap:12,maxWidth:440,marginTop:16}}>
    <h3>Нове тестове зобов'язання</h3>
    <label className="field">Назва<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label className="field">Напрям<select value={project} onChange={e=>setProject(e.target.value as P)}>{Object.entries(projects).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label className="field">Категорія<input maxLength={120} value={category} onChange={e=>setCategory(e.target.value)}/></label>
    <label className="field">Сума, грн<input required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="20000,00"/></label>
    <label className="field">Строк<input required type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>
    <button className="primary" disabled={busy}>Зберегти на сервері</button>
   </form>
   <div className="expense-scroll" style={{marginTop:24}}>
    <table className="expense-table"><thead><tr><th>Назва</th><th>Напрям</th><th>Сума</th><th>Погашено</th><th>Залишок</th><th>Дія</th></tr></thead>
    <tbody>{rows.map(r=><tr key={r.id}><td>{r.title||'Тестовий запис без назви'}<small>{r.category}</small></td><td>{projects[r.project as P]}</td><td>{showMinor(r.amountMinor)}</td><td>{showMinor(r.paidMinor)}</td><td>{showMinor(r.remainingMinor)}</td><td><button type="button" className="secondary small" disabled={busy||r.remainingMinor==='0'} onClick={()=>setTarget(r)}>Платіж</button></td></tr>)}
    {rows.length===0&&!busy&&<tr><td colSpan={6}>Поки немає зобов'язань</td></tr>}</tbody></table>
   </div>
   {target&&<form onSubmit={prepare} style={{display:'flex',gap:10,marginTop:18,alignItems:'end'}}>
     <label className="field">Платіж до {target.title||target.id}, грн<input required value={payment} onChange={e=>setPayment(e.target.value)}/></label>
     <button className="primary" disabled={busy}>Зберегти очікуваний платіж</button><button type="button" className="secondary" onClick={()=>setTarget(null)}>Скасувати</button>
   </form>}
   {rows.some(r=>r.payments.length>0)&&<div style={{marginTop:20}}><h3>Черга платежів</h3>{rows.flatMap(r=>r.payments.map(p=><div className="expense-pending-row" key={p.id}><strong>{r.title||r.id}</strong><span>{showMinor(p.amountMinor)}</span><span>{p.state==='submitted'?'Очікує звірки':p.state==='confirmed'?'Підтверджений банком':p.state}</span></div>))}</div>}
  </div>
 </>;
}
