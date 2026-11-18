import http from 'node:http';
import { createRepository } from './repository.mjs';
import {createMonthlyForecastRepository} from './monthly-forecast-repository.mjs';

/** PRIVATE API. Bound to loopback, protected by server token; no CORS and no public reverse proxy. */
export function makeServer(pool, token) {
  if(typeof token !== 'string' || token.length < 32) throw new Error('An independent random API token (>= 32 chars) is required');
  const repo=createRepository(pool);
  const forecast=createMonthlyForecastRepository(pool);
  return http.createServer(async(req,res)=>{
    const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
    if(req.headers.authorization!==`Bearer ${token}`) return send(401,{error:'Unauthorized'});
    try {
      if(req.method==='GET' && req.url==='/health') return send(200,{ok:true});
      if(req.method==='GET' && req.url?.startsWith('/categories?')) {
        const parsed=new URL(req.url,'http://localhost');
        if(parsed.pathname !== '/categories' || [...parsed.searchParams.keys()].some(k=>!['project','type'].includes(k))
            || parsed.searchParams.getAll('project').length!==1 || parsed.searchParams.getAll('type').length>1)
          return send(400,{error:'Invalid category filters'});
        return send(200,await repo.listCategories({
          project:parsed.searchParams.get('project'),
          economicType:parsed.searchParams.has('type')?parsed.searchParams.get('type'):undefined,
        }));
      }
      if(req.method==='GET' && req.url==='/categories') return send(400,{error:'Project required'});

      if(req.method==='GET' && req.url?.startsWith('/forecast/monthly?')) {
        const url=new URL(req.url,'http://localhost');
        if(url.pathname!=='/forecast/monthly'||[...url.searchParams.keys()].some(k=>k!=='month')||url.searchParams.getAll('month').length!==1)
          return send(400,{error:'Invalid forecast query'});
        return send(200,await forecast.list(url.searchParams.get('month')));
      }
      if(req.method==='GET' && req.url?.startsWith('/forecast/monthly/history?')) {
        const url=new URL(req.url,'http://localhost');
        if(url.pathname!=='/forecast/monthly/history'
            || [...url.searchParams.keys()].some(k=>k!=='id')
            || url.searchParams.getAll('id').length!==1)
          return send(400,{error:'Invalid forecast history query'});
        return send(200,await forecast.history({id:url.searchParams.get('id')}));
      }
      if(req.method==='GET' && req.url==='/obligations') return send(200,await repo.listObligations());
      if(req.method==='GET' && /^\/obligations\/[a-zA-Z0-9_-]{1,120}$/.test(req.url||'')) {
        const result=await repo.getObligation(req.url.slice('/obligations/'.length));
        return result?send(200,result):send(404,{error:'Not found'});
      }
      const routes={
        '/accounts':repo.addAccount,
        '/obligations':repo.addObligation,
        '/transactions':repo.addTransaction,
        '/payments':repo.addPayment,
        '/forecast/monthly/lines':forecast.create,
        '/forecast/monthly/preview':forecast.preview,
        '/forecast/monthly/confirm':forecast.confirm,
        '/forecast/monthly/revise':forecast.revise
      };
      if(req.method!=='POST' || !Object.hasOwn(routes,req.url||'')) return send(404,{error:'Not found'});
      let raw='';
      for await (const chunk of req) {
        raw+=chunk;
        if(raw.length>32768) return send(413,{error:'Body too large'});
      }
      let value;try {value=JSON.parse(raw);} catch {return send(400,{error:'Invalid JSON'});}
      const result=await routes[req.url](value);
      return send(201,result);
    } catch(error) {
      if(error.message==='Forecast changed since last read') return send(409,{error:'Forecast changed since last read'});
      if(error.code==='23505'||error.message==='Duplicate monthly forecast template') return send(409,{error:'Duplicate identifier/source'});
      if(error.code==='23503') return send(400,{error:'Referenced record not found'});
      if(error.code==='23514') return send(400,{error:'Database constraint failed'});
      if(error.message?.startsWith('Invalid ') || /mismatch|Unknown |requires |exceeds |Expected |Amount must|Unsupported|Target must|positive minor-unit|Duplicate recurring/.test(error.message)) return send(400,{error:error.message});
      console.error('Finance API request failed:',error.code || error.name);
      return send(500,{error:'Internal server error'});
    }
  });
}
