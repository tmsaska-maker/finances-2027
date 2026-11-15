/**
 * Shared finance authentication port for EVERY UI screen, not only Expenses.
 * Login/logout happens at same-origin HTTPS; browser never receives FINANCES_API_TOKEN.
 * No credentials or session data are saved in localStorage.
 */
type Fetcher=(url:string, init:RequestInit)=>Promise<Response>;
async function request(path:string,init:RequestInit,fetcher:Fetcher):Promise<Response> {
 const r=await fetcher('/finance-api/'+path,{...init,credentials:'same-origin',cache:'no-store'});
 if(!r.ok)throw Error(r.status===401?'Неправильні дані входу':r.status===403?'Доступ заборонено':'Помилка доступу: '+r.status);
 return r;
}
export async function readFinanceSession(fetcher:Fetcher=fetch):Promise<boolean> {
 const r=await request('session',{method:'GET'},fetcher);
 const data:unknown=await r.json();
 if(!data ||typeof data!=='object'||!('authenticated' in data)||typeof data.authenticated!=='boolean')throw Error('Некоректна відповідь авторизації');
 return data.authenticated;
}
export async function loginFinance(password:string,fetcher:Fetcher=fetch):Promise<void>{
 if(!password ||password.length>256)throw Error('Невірний пароль');
 await request('login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})},fetcher);
}
export async function logoutFinance(fetcher:Fetcher=fetch):Promise<void>{
 await request('logout',{method:'POST'},fetcher);
}
