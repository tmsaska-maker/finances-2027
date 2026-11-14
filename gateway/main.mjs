import { makeGateway } from './gateway.mjs';
if (process.env.NODE_ENV !== 'production') throw Error('Gateway requires production mode');
const server = makeGateway({
  apiToken: process.env.FINANCES_API_TOKEN,
  gatewayKey: process.env.FINANCES_GATEWAY_KEY,
  origin: 'https://finances.screening40.com.ua',
});
server.listen(8092, '0.0.0.0', () => console.log('Finance gateway listening on container port 8092'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
