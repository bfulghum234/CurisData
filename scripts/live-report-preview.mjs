import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { onRequest as urgentCare } from '../functions/api/urgent-care.js';
const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css', '.svg': 'image/svg+xml' };
// Local preview uses deployed source endpoints; no keys or source files are saved.
http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/api/urgent-care') {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const config = await (await fetch('https://www.curiscorp.com/login')).json();
      const result = await urgentCare({
        request: new Request('http://127.0.0.1/api/urgent-care', { method: 'POST', body: Buffer.concat(chunks), headers: { 'Content-Type': 'application/json' } }),
        env: { GOOGLE_MAPS_API_KEY: config.googleMapsApiKey }
      });
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(await result.text());
      return;
    }
    if (url.pathname === '/login' || url.pathname.startsWith('/data/') || url.pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const upstream = await fetch('https://www.curiscorp.com' + url.pathname + url.search, {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
        body: request.method === 'POST' ? Buffer.concat(chunks) : undefined
      });
      response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) || !Object.hasOwn(types, path.extname(file))) {
      response.writeHead(404); response.end(); return;
    }
    const data = await fs.readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store' });
    response.end(data);
  } catch (error) {
    response.writeHead(502); response.end('Preview source unavailable: ' + error.message);
  }
}).listen(8788, '127.0.0.1', () => console.log('Live report preview: http://127.0.0.1:8788/urgent_care_live.html'));
