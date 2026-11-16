// Synthetic-only, run inside an ephemeral isolated Docker CI network.
import http from 'node:http';
const expected='Bearer synthetic-api-token-that-is-long-1234567890';
http.createServer((req,res)=>{
 res.setHeader('content-type','application/json');
 res.setHeader('cache-control','no-store');
 if(req.headers.authorization!==expected){res.writeHead(401);return res.end('{"error":"Unauthorized"}');}
 if(req.method==='GET' && req.url==='/categories?project=personal&type=expense')return res.end(JSON.stringify({records:[{id:'synthetic-category',name:'Fixture'}]}));
 if(req.method==='GET' && req.url==='/obligations')return res.end(JSON.stringify({records:[{id:'synthetic-only',amount:123}]}));
 res.writeHead(404);res.end('{"error":"Not found"}');
}).listen(8091,'0.0.0.0');
