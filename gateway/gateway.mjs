import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const paths = new Map([
  ['/health', new Set(['GET'])],
  ['/obligations', new Set(['GET', 'POST'])],
  ['/accounts', new Set(['POST'])],
  ['/transactions', new Set(['POST'])],
  ['/payments', new Set(['POST'])],
]);
const headers = {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'};
const MAX_BODY = 32768;
function sameSecret(expected, supplied) {
  if (typeof supplied !== 'string' || !supplied || Buffer.byteLength(expected) !== Buffer.byteLength(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}
function allowedRoute(path, method) {
  if (paths.get(path)?.has(method)) return true;
  return method === 'GET' && /^\/obligations\/[a-zA-Z0-9_-]{1,120}$/.test(path);
}

/** Finance-only gateway: ONLY Caddy may call it; API bearer token never reaches browser. */
export function makeGateway({apiToken, gatewayKey, origin, upstream = 'http://api:8091', fetchImpl = fetch}) {
  if (typeof apiToken !== 'string' || apiToken.length < 32) throw Error('Missing independent FINANCES_API_TOKEN');
  if (typeof gatewayKey !== 'string' || gatewayKey.length < 32) throw Error('Missing independent FINANCES_GATEWAY_KEY');
  if (apiToken === gatewayKey) throw Error('Gateway key must differ from API token');
  const allowedOrigin = new URL(origin);
  if (allowedOrigin.protocol !== 'https:' || allowedOrigin.origin !== origin) throw Error('Origin must be an exact HTTPS origin');
  const backend = new URL(upstream);
  if (backend.protocol !== 'http:' || (backend.hostname !== 'api' && backend.hostname !== '127.0.0.1')) throw Error('Upstream must be private finance API');
  return http.createServer(async (req, res) => {
    const send = (status, body) => {res.writeHead(status, headers); res.end(JSON.stringify(body));};
    if (!sameSecret(gatewayKey, req.headers['x-finances-gateway-key'])) return send(403, {error: 'Forbidden'});
    const path = req.url || '';
    if (!allowedRoute(path, req.method)) return send(404, {error: 'Not found'});
    if (req.method === 'POST') {
      if (req.headers.origin !== origin) return send(403, {error: 'Origin not permitted'});
      if (!/^application\/json(?:\s*;|\s*$)/i.test(req.headers['content-type'] || '')) return send(415, {error: 'JSON required'});
      if (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') return send(403, {error: 'Cross-site request blocked'});
    }
    let body;
    if (req.method === 'POST') {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) return send(413, {error: 'Body too large'});
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }
    try {
      const response = await fetchImpl(new URL(path, backend), {
        method: req.method,
        headers: {authorization: `Bearer ${apiToken}`, ...(body ? {'content-type': 'application/json'} : {})},
        body,
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
      const text = await response.text();
      if (text.length > 2_000_000) return send(502, {error: 'Upstream response too large'});
      res.writeHead(response.status, headers);
      res.end(text);
    } catch (error) {
      console.error('Finance gateway upstream failure:', error.name);
      return send(502, {error: 'Finance API unavailable'});
    }
  });
}
