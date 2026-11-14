/** Browser adapter for a future same-origin, authenticated reverse-proxy.
 * Never embed FINANCES_API_TOKEN in frontend source. */
export type ServerBill = {
 id:string; project:'ambulatory'|'screening'|'psychotherapy'|'personal';
 title:string; category:string; plannedBank:string; note:string; currency:string;
 dueDate:string; amountMinor:string; paidMinor:string; remainingMinor:string;
 payments:{id:string;amountMinor:string;state:string;bankTransactionId:string|null}[];
};
export function parseMoney(text:string):number {
 const t=text.trim().replace(',','.');
 if(!/^(0|[1-9]\\d*)(?:\\.\\d{1,2})?$/.test(t)) throw Error('Невірна сума: максимум 2 знаки після коми');
 const [w,f='']=t.split('.');
 const v=Number(w)*100+Number(f.padEnd(2,'0'));
 if(!Number.isSafeInteger(v)||v<=0) throw Error('Сума має бути додатною');
 return v;
}
export function showMinor(text:string):string {
 if(!/^\\d+$/.test(text)) throw Error('Невірний формат суми');
 const n=BigInt(text);return (n/100n).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ') + ',' + (n%100n).toString().padStart(2,'0')+' грн';
}
async function call<T>(path:string,opts?:RequestInit):Promise<T> {
 const r=await fetch('/finance-api'+path,{...opts,credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json',...(opts?.headers||{})}});
 if(r.status===401||r.status===403)throw Error('Немає доступу до серверної тестової бази');
 if(!r.ok)throw Error('Серверна помилка '+r.status);
 return await r.json() as T;
}
export const financeServer = {
 list:async()=> (await call<{records:ServerBill[]}>('/obligations')).records,
 create:async(data:{project:string,title:string,category:string,plannedBank:string,note:string,dueDate:string,amountMinor:number})=>call('/obligations',{method:'POST',body:JSON.stringify({...data,id:'ui-'+crypto.randomUUID(),currency:'UAH'})}),
 pending:async(id:string,currency:string,amountMinor:number)=>call('/payments',{method:'POST',body:JSON.stringify({id:'pay-'+crypto.randomUUID(),obligationId:id,currency,amountMinor,state:'submitted'})})
};
