import {createFinanceBrowserGateway} from './browser-gateway.mjs';

// Candidate only, NOT deployed. Docker listener is on the container interface;
// the future host publication MUST remain bound to 127.0.0.1, never a public port.
if(process.env.NODE_ENV!=='production')throw Error('Gateway requires production mode');
const apiOrigin=process.env.FINANCES_GATEWAY_API_ORIGIN||'http://127.0.0.1:8091';
const bindHost=process.env.FINANCES_GATEWAY_BIND_HOST||'127.0.0.1';
if(!['127.0.0.1','0.0.0.0'].includes(bindHost))throw Error('Invalid gateway bind host');
if(bindHost==='0.0.0.0'&&apiOrigin!=='http://api:8091')throw Error('Docker gateway requires isolated finance API service');
const server=createFinanceBrowserGateway({
 publicOrigin:process.env.FINANCES_PUBLIC_ORIGIN,
 apiOrigin,
 apiToken:process.env.FINANCES_API_TOKEN,
 sessionSecret:process.env.FINANCES_SESSION_SECRET,
 passwordDigest:process.env.FINANCES_OWNER_PASSWORD_HASH
});
server.listen(8092,bindHost,()=>console.log('Finance gateway candidate ready'));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>process.exit(0)));
