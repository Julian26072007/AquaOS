import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const suites = ['browser', 'lighting', 'field', 'schedule', 'natural', 'weather-rendering', 'weather-scattering', 'live-weather'];
const selected = process.argv.slice(2);
if (selected.some(name => !suites.includes(name))) {
  console.error(`Choose suites: ${suites.join(', ')}`);
  process.exit(1);
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
let server;
let url = process.env.TEST_URL;
if (!url) {
  // Exercise case-sensitive GitHub Pages project-path hosting on an unused port.
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!pathname.startsWith('/AquaOS/')) { res.writeHead(404).end(); return; }
      const relative = pathname.slice('/AquaOS/'.length) || 'index.html';
      const path = resolve(root, relative);
      if (!path.startsWith(root.endsWith(sep) ? root : root + sep) || relative.split('/').some(p => p.startsWith('.'))) {
        res.writeHead(404).end(); return;
      }
      const data = await readFile(path);
      res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' }).end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  url = `http://127.0.0.1:${server.address().port}/AquaOS/`;
}
try {
  // Sequential runs keep the rendering performance check free of suite contention.
  for (const name of selected.length ? selected : suites) {
    const start = performance.now();
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [`tests/${name}.cjs`], {
        cwd: root, env: { ...process.env, TEST_URL: url }, stdio: 'inherit',
      });
      child.once('error', reject);
      child.once('exit', code => resolve(code ?? 1));
    });
    console.log(`${name}: ${((performance.now() - start) / 1000).toFixed(2)}s`);
    if (code) { process.exitCode = code; break; }
  }
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
}
