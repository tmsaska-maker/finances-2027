// FAKE pre-release gateway; simulates legacy 403. Never a production image.
import http from 'node:http';
http.createServer((req,res)=>{
 res.writeHead(403,{'content-type':'application/json','cache-control':'no-store'});
 res.end('{"error":"Forbidden"}');
}).listen(8092,'0.0.0.0');
