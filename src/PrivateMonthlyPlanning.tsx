import {useEffect,useState} from "react";
import {loadFinanceCategories,type FinanceCategory} from "./domain/finance-categories";
import {loadMonthlyForecast,previewMonthlyForecast,confirmMonthlyForecast,createMonthlyLine,parseForecastMoney,minorMoney,adjacentMonths,type MonthlyLine,type MonthlyPreview} from "./domain/monthly-forecast-api";

type Project="Усі напрями"|"Амбулаторія"|"Скринінг"|"Психотерапія";
const projectIds={"Амбулаторія":"ambulatory","Скринінг":"screening","Психотерапія":"psychotherapy"} as const;
type ProjectId=typeof projectIds[keyof typeof projectIds];
const fmt=(minor:number)=>new Intl.NumberFormat("uk-UA",{style:"currency",currency:"UAH"}).format(minor/100);
const nextMonth=()=>{
 const d=new Date();return String(d.getFullYear()+(d.getMonth()===11?1:0))+"-"+String((d.getMonth()+1)%12+1).padStart(2,"0");
};
export default function PrivateMonthlyPlanning({project,setProject,notify}:{
 project:Project;setProject:(p:Project)=>void;notify:(message:string)=>void;
}){
 const [targetMonth,setTargetMonth]=useState(nextMonth);
 const sourceMonth=adjacentMonths(targetMonth);
 const [records,setRecords]=useState<MonthlyLine[]>([]);
 const [catalog,setCatalog]=useState<Partial<Record<ProjectId,FinanceCategory[]>>>({});
 const [preview,setPreview]=useState<MonthlyPreview|null>(null);
 const [selected,setSelected]=useState<string[]>([]);
 const [amounts,setAmounts]=useState<Record<string,string>>({});
 const [dates,setDates]=useState<Record<string,string>>({});
 const [step,setStep]=useState(1);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [seed,setSeed]=useState(false);
 const [name,setName]=useState("");
 const [amount,setAmount]=useState("");
 const [day,setDay]=useState("05");
 const [category,setCategory]=useState("");
 const [kind,setKind]=useState<"fixed"|"estimated">("estimated");
 const activeProject=project==="Усі напрями"?"Амбулаторія":project;
 const activeId=projectIds[activeProject];
 const options=catalog[activeId]||[];
 const visible=(all:MonthlyLine[])=>all.filter(r=>project==="Усі напрями"||r.project===activeId);
 const fail=(e:unknown)=>setError(e instanceof Error?e.message:"Помилка планування");
 useEffect(()=>{
  let active=true;setBusy(true);setError("");setStep(1);setPreview(null);
  void Promise.all([
   loadMonthlyForecast(targetMonth),
   loadFinanceCategories("ambulatory","expense"),
   loadFinanceCategories("screening","expense"),
   loadFinanceCategories("psychotherapy","expense")
  ]).then(([result,a,s,p])=>{
   if(active){setRecords(result.records);setCatalog({ambulatory:a.records,screening:s.records,psychotherapy:p.records})}
  }).catch(e=>{if(active){setRecords([]);setCatalog({});fail(e)}}).finally(()=>{if(active)setBusy(false)});
  return ()=>{active=false};
 },[targetMonth]);
 const begin=async()=>{
  setBusy(true);setError("");
  try{
   const p=await previewMonthlyForecast(sourceMonth,targetMonth);
   setPreview(p);setSelected(p.proposed.map(x=>x.id));
   setAmounts(Object.fromEntries(p.proposed.map(x=>[x.id,minorMoney(x.amountMinor)])));
   setDates(Object.fromEntries(p.proposed.map(x=>[x.id,x.dueDate])));setStep(2);
  }catch(e){fail(e)}finally{setBusy(false)}
 };
 const save=async()=>{
  if(!preview)return;setBusy(true);setError("");
  try{
   const edits:Record<string,{amountMinor:number;dueDate:string}>={};
   for(const r of preview.proposed.filter(x=>selected.includes(x.id)))
    edits[r.id]={amountMinor:parseForecastMoney(amounts[r.id]||""),dueDate:dates[r.id]||r.dueDate};
   const out=await confirmMonthlyForecast(sourceMonth,targetMonth,selected,edits);
   setRecords(out.records);setStep(3);setPreview(null);
   notify("У PostgreSQL збережено "+out.inserted+" прогнозних рядків");
  }catch(e){fail(e)}finally{setBusy(false)}
 };
 const seedSource=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setError("");
  try{
   if(!options.some(x=>x.id===category))throw Error("Обери категорію з довідника");
   const [y,m]=sourceMonth.split("-").map(Number);
   const dueDay=Math.min(Number(day),new Date(Date.UTC(y,m,0)).getUTCDate());
   if(!Number.isInteger(Number(day))||Number(day)<1||Number(day)>31)throw Error("Некоректний день");
   await createMonthlyLine({
    month:sourceMonth,project:activeId,categoryId:category,title:name.trim(),currency:"UAH",
    amountMinor:parseForecastMoney(amount),dueDate:sourceMonth+"-"+String(dueDay).padStart(2,"0"),
    sourceTemplateId:"rec_"+crypto.randomUUID().replaceAll("-",""),recurring:true,amountKind:kind
   });
   setSeed(false);setName("");setAmount("");notify("Повторювану основу збережено в "+sourceMonth);
  }catch(e){fail(e)}finally{setBusy(false)}
 };
 const candidates=visible(preview?.proposed||[]);
 const existing=visible(records);
 const chosen=candidates.filter(x=>selected.includes(x.id));
 const sum=chosen.reduce((n,x)=>n+(Number((amounts[x.id]||"0").replace(",","."))||0)*100,0);
 const label=(x:MonthlyLine)=>catalog[x.project as ProjectId]?.find(c=>c.id===x.categoryId)?.name||x.categoryId;
 return <>
  <div className="page-heading">
   <div><div className="eyebrow">Планування · {project} · {targetMonth}</div>
    <h1>Створити платіжний план</h1>
    <p>Переносимо повторювані прогнозні витрати пакетом, без дублювання боргів</p></div>
   <div className="heading-actions"><label>Місяць плану <input aria-label="Місяць плану" type="month" value={targetMonth} onChange={e=>setTargetMonth(e.target.value)}/></label></div>
  </div>
  <div className="stepper">
   <span className={step===1?"active":""}><i>1</i>Основа плану</span><b/>
   <span className={step===2?"active":""}><i>2</i>Редагування</span><b/>
   <span className={step===3?"active":""}><i>3</i>Підтвердження</span>
  </div>
  <div className="expenses-notice">Прогнозні суми не є оплатою й не змінюють затверджений BUDGET. Не вводь реальні дані до погодженого запуску.</div>
  {busy&&<div className="expenses-notice" role="status">Виконується запит до PostgreSQL…</div>}
  {error&&<div className="expenses-notice" role="alert">{error}. Демодані не підставляємо.</div>}
  <div className="template-grid">
   <button className="template selected" type="button" disabled={busy} onClick={begin}>
    <span className="radio"/><strong>На основі {sourceMonth}</strong>
    <p>Пакетне перенесення регулярних платежів</p><small>Рекомендовано</small>
   </button>
   <button className="template" type="button" disabled>
    <strong>З річного бюджету</strong><p>Буде доступно після підключення BUDGET snapshot</p>
   </button>
   <button className="template" type="button" disabled={busy} onClick={()=>{setSeed(!seed);setCategory("")}}>
    <strong>Додати повторювану основу</strong><p>Перший запис у {sourceMonth}, якщо ще нема що переносити</p>
   </button>
  </div>
  {seed&&<section className="table-card" style={{padding:20}}>
   <h2>Повторювана витрата · {sourceMonth} · {activeProject}</h2>
   <form className="expense-form-grid" onSubmit={seedSource}>
    <label>Назва або контрагент<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Категорія<select required value={category} onChange={e=>setCategory(e.target.value)}>
     <option value="">Обери категорію</option>
     {options.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>
    <label>Прогнозна сума, грн<input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="2500,00"/></label>
    <label>День місяця<input required type="number" min="1" max="31" value={day} onChange={e=>setDay(e.target.value)}/></label>
    <label>Тип суми<select value={kind} onChange={e=>setKind(e.target.value as "fixed"|"estimated")}>
     <option value="estimated">Приблизна</option><option value="fixed">Постійна</option></select></label>
    <div className="expense-modal-actions">
     <button type="button" className="secondary" onClick={()=>setSeed(false)}>Скасувати</button>
     <button type="submit" className="primary" disabled={busy}>Зберегти основу</button>
    </div>
   </form>
  </section>}
  {step===2&&preview&&<>
   <div className="plan-summary">
    <div><span>Обрано до перенесення</span><strong>{chosen.length} рядків</strong></div>
    <div><span>Сума прогнозу</span><strong>{fmt(Math.round(sum))}</strong></div>
    <div><span>Уже існують у місяці</span><strong>{existing.length}</strong></div>
    <div className="summary-note">Повторення не створює дублікати</div>
   </div>
   <section className="table-card"><div className="table-tools">
     <strong>Перевір пакет для {targetMonth}</strong><span>Пропущено існуючих: {preview.skipped.length}</span>
    </div><div className="data-table plan-table">
     <div className="tr th"><span/><span>Контрагент / призначення</span><span>Категорія</span>
      <span>Дата</span><span>Сума, ₴</span><span>Тип</span><span/></div>
     {candidates.map(r=><div className="tr" key={r.id}>
      <span><input aria-label={"Обрати "+r.title} type="checkbox" checked={selected.includes(r.id)}
       onChange={e=>setSelected(v=>e.target.checked?[...v,r.id]:v.filter(id=>id!==r.id))}/></span>
      <span><strong>{r.title}</strong><small>{r.project}</small></span><span>{label(r)}</span>
      <span><input aria-label={"Дата "+r.title} type="date" value={dates[r.id]||r.dueDate}
       onChange={e=>setDates(v=>({...v,[r.id]:e.target.value}))}/></span>
      <span><input aria-label={"Сума "+r.title} className="money-input" value={amounts[r.id]||""}
       onChange={e=>setAmounts(v=>({...v,[r.id]:e.target.value}))}/></span>
      <span><em className="quiet-badge">{r.amountKind==="fixed"?"Постійна":"Приблизна"}</em></span><span/>
     </div>)}
     {candidates.length===0&&<div className="expenses-empty">Нових повторюваних витрат для перенесення немає.</div>}
    </div><div className="table-footer"><span>Це лише FORECAST — без створення боргу</span>
      <strong>{fmt(Math.round(sum))}</strong></div></section>
   <div className="footer-actions"><button className="secondary" onClick={()=>setStep(1)}>Назад</button>
    <button className="primary" disabled={busy||selected.length===0} onClick={save}>Зберегти пакет ({selected.length})</button></div>
  </>}
  {step===3&&<div className="expenses-notice" role="status">Пакет збережено. Оплати й борги не змінено.</div>}
  <section className="table-card">
   <div className="table-tools"><div className="tabs"><button className="active">
    План {targetMonth} <span>{existing.length}</span></button></div>
    <button className="secondary small" disabled={busy} onClick={()=>void loadMonthlyForecast(targetMonth).then(v=>setRecords(v.records)).catch(fail)}>Оновити</button></div>
   <div className="data-table plan-table">
    <div className="tr th"><span/><span>Контрагент / призначення</span><span>Категорія</span>
      <span>Дата</span><span>Сума, ₴</span><span>Тип</span><span/></div>
    {existing.map(r=><div className="tr" key={r.id}><span/><span><strong>{r.title}</strong>
      <small>{r.project}</small></span><span>{label(r)}</span><span>{r.dueDate.split("-").reverse().join(".")}</span>
      <span>{fmt(r.amountMinor)}</span><span><em className="quiet-badge neutral">Прогноз</em></span><span/></div>)}
    {existing.length===0&&<div className="expenses-empty">Немає збережених прогнозних рядків у цьому місяці.</div>}
   </div></section>
 </>;
}
