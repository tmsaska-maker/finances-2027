import { Pool } from 'pg';
import { makeServer } from './http.mjs';

if (process.env.NODE_ENV !== 'production') {
  console.error('Server requires NODE_ENV=production and a private database.');
  process.exit(1);
}
if (!process.env.FINANCES_DATABASE_URL || !process.env.FINANCES_API_TOKEN) {
  console.error('Missing FINANCES_DATABASE_URL or FINANCES_API_TOKEN');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.FINANCES_DATABASE_URL, max: 5 });
await pool.query('SELECT 1');
const server=makeServer(pool,process.env.FINANCES_API_TOKEN);
server.listen(8091,'127.0.0.1',()=>console.log('Finances API listening on loopback only, 127.0.0.1:8091'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(async()=>{await pool.end();process.exit(0);}));
