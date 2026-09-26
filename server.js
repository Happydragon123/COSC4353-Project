import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 8000);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};

createServer(async (request,response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (file !== root && !file.startsWith(root + sep)) {response.writeHead(403).end('Forbidden'); return;}
  try {
    const body = await readFile(file);
    response.writeHead(200, {'Content-Type':mime[extname(file)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'}).end(body);
  } catch {
    response.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('Not found');
  }
}).listen(port, () => console.log(`QueueSmart running at http://localhost:${port}`));
