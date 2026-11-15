import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {readFinanceSession,loginFinance,logoutFinance} from './finance-session.ts';
test('shared finance session is same-origin cookie-based, not localStorage or bearer',async()=>{
 const calls:Array<{url:string,init:RequestInit}>=[];
 const fetcher=async(url:string,init:RequestInit):Promise<Response>=>{
  calls.push({url,init});return new Response(JSON.stringify({authenticated:true}),{status:200});
 };
 assert.equal(await readFinanceSession(fetcher),true);
 await loginFinance('demo-valid-password',fetcher);
 await logoutFinance(fetcher);
 assert.deepEqual(calls.map(x=>x.url),['/finance-api/session','/finance-api/login','/finance-api/logout']);
 assert.ok(calls.every(x=>x.init.credentials==='same-origin'&&x.init.cache==='no-store'&&!JSON.stringify(x.init).includes('Authorization')));
 assert.deepEqual(JSON.parse(calls[1].init.body as string),{password:'demo-valid-password'});
});
test('shared session denies missing login, malformed session and authentication failures',async()=>{
 await assert.rejects(()=>loginFinance('',async()=>new Response('{}')),/пароль/);
 await assert.rejects(()=>readFinanceSession(async()=>new Response('{}')),/Некоректна/);
 await assert.rejects(()=>loginFinance('wrong',async()=>new Response('{}',{status:401})),/Неправильні/);
});
