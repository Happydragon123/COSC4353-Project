import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {handleApi} from './src/backend/http.js';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 8000);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch {
    const error = new Error('Invalid JSON');
    error.status = 400;
    throw error;
  }
}

createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }

  if (pathname.startsWith('/api/')) {
    try {
      const body = ['POST', 'PUT', 'PATCH'].includes(request.method) ? await readJsonBody(request) : null;
      const result = handleApi({method: request.method, pathname, headers: request.headers, body});
      const headers = {'X-Content-Type-Options': 'nosniff'};
      if (result.body == null) {
        response.writeHead(result.status, headers).end();
        return;
      }
      headers['Content-Type'] = 'application/json; charset=utf-8';
      response.writeHead(result.status, headers).end(JSON.stringify(result.body));
    } catch (error) {
      const status = error.status || 500;
      response.writeHead(status, {'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'})
        .end(JSON.stringify({error: status === 400 ? 'Invalid JSON' : 'Server error'}));
    }
    return;
  }

  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (file !== root && !file.startsWith(root + sep)) {response.writeHead(403).end('Forbidden'); return;}
  try {
    const body = await readFile(file);
    response.writeHead(200, {'Content-Type':mime[extname(file)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'}).end(body);
  } catch {
    response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('Not found');
  }
}).listen(port, () => console.log(`QueueSmart running at http://localhost:${port}`));
