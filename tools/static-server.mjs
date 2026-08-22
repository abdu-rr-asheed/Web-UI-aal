#!/usr/bin/env node
/**
 * Minimal static file server for CI audit steps.
 *
 * Zero dependencies on purpose: this exists so pa11y-ci has something to point
 * at, and pulling a package into the audit path would mean the thing being
 * audited depends on code nobody reviewed. Thirty lines of node:http is cheaper
 * than that trade.
 *
 * Usage: node tools/static-server.mjs <dir> [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, normalize } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist/docs/browser');
const port = Number(process.argv[3] ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    // normalize + prefix check: a path-traversal bug in a test server would
    // still be a path-traversal bug.
    let path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!path.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let s = await stat(path).catch(() => null);
    if (s?.isDirectory()) {
      path = join(path, 'index.html');
      s = await stat(path).catch(() => null);
    }
    // SPA fallback so client-side routes resolve.
    if (!s) path = join(root, 'index.html');

    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

server.listen(port, () => console.log(`static-server: ${root} -> http://localhost:${port}`));
