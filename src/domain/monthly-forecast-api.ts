/** Private browser-only adapter: API bearer remains on the server, never in React. */
export type MonthlyLine={
 id:string;month:string;project:'ambulatory'|'screening'|'psychotherapy'|'personal';
 categoryId:string;title:string;currency:'UAH'|'USD'|'EUR';
 amountMinor:number;dueDate:string;sourceTemplateId:string;amountKind:'fixed'|'estimated';
 status:'draft';recurring:boolean;
};
export type MonthlyPreview={
 sourceMonth:string;targetMonth:string;proposed:MonthlyLine[];
 skipped:Array<{project:string;templateId:string;reason:string}>;
};
type Fetcher=(url:string,init:RequestInit)=>Promise<Response>;
async function request<T>(path:string,method:'GET'|'POST',body?:unknown,fetcher:Fetcher=fetch):Promise<T>{
 const result=await fetcher('/finance-api/forecast/monthly'+path,{
  method,credentials:'same-origin',cache:'no-store',
  ...(method==='POST'?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})
 });
 if(result.status===401||result.status===403)throw Error('Сесія завершена. Увійди знову.');
 if(!result.ok)throw Error('Сервер не зберіг фінансовий план (HTTP '+result.status+')');
 return await result.json() as T;
}
export const loadMonthlyForecast=(month:string,fetcher?:Fetcher)=>
 request<{month:string;records:MonthlyLine[]}>('?month='+encodeURIComponent(month),'GET',undefined,fetcher);
export const previewMonthlyForecast=(sourceMonth:string,targetMonth:string,fetcher?:Fetcher)=>
 request<MonthlyPreview>('/preview','POST',{sourceMonth,targetMonth},fetcher);
export const createMonthlyLine=(line:Omit<MonthlyLine,'id'|'status'>,fetcher?:Fetcher)=>
 request<{record:MonthlyLine}>('/lines','POST',line,fetcher);
export const confirmMonthlyForecast=(sourceMonth:string,targetMonth:string,selectedIds:string[],
 edits:Record<string,{amountMinor:number;dueDate:string}>,fetcher?:Fetcher)=>
 request<{month:string;inserted:number;records:MonthlyLine[]}>('/confirm','POST',{
  sourceMonth,targetMonth,selectedIds,edits
 },fetcher);
export function parseForecastMoney(text:string):number {
 if(!/^(?:0|[1-9]\d{0,12})(?:[.,]\d{1,2})?$/.test(text.trim()))throw Error('Введи додатну суму з точністю до копійок');
 const [whole,part='']=text.trim().replace(',','.').split('.');
 const result=BigInt(whole)*100n+BigInt((part+'00').slice(0,2));
 if(result<=0n||result>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Некоректна сума');
 return Number(result);
}
export const minorMoney=(amountMinor:number)=> (amountMinor/100).toFixed(2);
export const adjacentMonths=(targetMonth:string)=>{
 const [year,month]=targetMonth.split('-').map(Number);
 return month===1?(`${year-1}-12`):(`${year}-${String(month-1).padStart(2,'0')}`);
};
