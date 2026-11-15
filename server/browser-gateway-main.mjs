import {createFinanceBrowserGateway} from './browser-gateway.mjs';

// Separate loopback-only gateway process on EXISTING Lightsail, NOT deployed automatically.
// Do not enable reverse proxy or expose finance API until user auth/security review.
if(process.env.NODE_ENV!=='production')throw Error('Gateway requires production mode');
const server=createFinanceBrowserGateway({
 publicOrigin:process.env.FINANCES_PUBLIC_ORIGIN,
 apiOrigin:'http://127.0.0.1:8091',
 apiToken:process.env.FINANCES_API_TOKEN,
 sessionSecret:process.env.FINANCES_SESSION_SECRET,
 passwordDigest:process.env.FINANCES_OWNER_PASSWORD_HASH
});
server.listen(8092,'127.0.0.1',()=>console.log('Private finance gateway ready on loopback:8092'));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close(()=>process.exit(0)));
