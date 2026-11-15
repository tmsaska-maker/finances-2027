import type {DemoExpense} from './expense-session.ts';
import {readFinanceSession} from './finance-session.ts';

type Fetcher=(input:string,init:RequestInit)=>Promise<Response>;
export type ReadOnlyFinanceExpense = DemoExpense & {serverId:string};
const names={ambulatory:'Амбулаторія',screening:'Скринінг',psychotherapy:'Психотерапія'} as const;
function record(v:unknown):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Некоректний запис зобов’язання');
 return v as Record<string,unknown>;
}
function exactMinor(value:unknown):number {
 if(typeof value!=='string'|| !/^\d+$/.test(value))throw Error('Некоректна сума в PostgreSQL');
 const minor=BigInt(value);
 if(minor>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Сума перевищує точність інтерфейсу');
 return Number(minor);
}
/** Strict read model for existing Figma ExpensesScreen: no writes, localStorage or demo fallback. */
export function parseLiveFinanceExpenses(value:unknown, today:string):ReadOnlyFinanceExpense[] {
 const root=record(value);
 if(!Array.isArray(root.records)||root.records.length>=500)throw Error('Реєстр потребує посторінкового завантаження; часткові підсумки заборонено');
 const ids=new Set<string>();
 return root.records.map((item:unknown,index:number)=>{
  const r=record(item);
  if(typeof r.id!=='string'||!r.id||ids.has(r.id))throw Error('Некоректний ID зобов’язання');
  ids.add(r.id);
  if(!Object.prototype.hasOwnProperty.call(names,String(r.project)))throw Error('Інтерфейс не підтримує цей напрям у бізнес-реєстрі');
  if(r.currency!=='UAH')throw Error('Змішані валюти не можна підсумовувати у гривневому KPI');
  const amount=exactMinor(r.amountMinor),paid=exactMinor(r.paidMinor);
  if(amount<=0||paid>amount||r.remainingMinor!==(amount-paid).toString())throw Error('Некоректний залишок зобов’язання');
  if(typeof r.dueDate!=='string'|| !/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate))throw Error('Некоректна дата');
  if(typeof r.title!=='string'||typeof r.category!=='string'||typeof r.plannedBank!=='string'||typeof r.note!=='string')throw Error('Некоректні поля зобов’язання');
  const status=paid===amount?'paid':paid>0?'partial':r.dueDate<today?'due':'planned';
  return {
   id:index+1,serverId:r.id,counterparty:r.title||'Зобов’язання без назви',
   category:r.category||'Не класифіковано',
   project:names[r.project as keyof typeof names],amount:amount/100,
   due:r.dueDate,bank:r.plannedBank,status,paid:paid/100,note:r.note
  };
 });
}
export async function loadReadOnlyFinanceExpenses(
 options:{fetcher?:Fetcher;signal?:AbortSignal;today?:string}={}
):Promise<ReadOnlyFinanceExpense[]>{
 const fetcher=options.fetcher??fetch;
 const authenticated=await readFinanceSession(fetcher);
 if(!authenticated)throw Error('Потрібен вхід у приватний фінансовий кабінет');
 const r=await fetcher('/finance-api/obligations',{method:'GET',credentials:'same-origin',cache:'no-store',signal:options.signal});
 if(r.status===401||r.status===403)throw Error('Сесію завершено: увійди знову');
 if(!r.ok)throw Error('Не вдалося прочитати реєстр: '+r.status);
 return parseLiveFinanceExpenses(await r.json(),options.today??new Date().toISOString().slice(0,10));
}
