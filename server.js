/**
 * Local development server: the same two API routes Vercel exposes as serverless
 * functions, plus static serving of the production build.
 *
 * The Monnify logic lives in api/_monnify.js and is shared with api/session.js and
 * api/transactions.js, so local behaviour and the deployment cannot drift apart.
 * On Vercel this file is not used at all — Vercel runs the functions in api/.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAccessToken,
  queryStringOf,
  readConfig,
  searchTransactions,
} from './api/_monnify.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(ROOT, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/** Minimal .env reader for local runs. Real environment variables always win. */
async function loadEnvFile(file = path.join(ROOT, '.env')) {
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    return; // no .env is fine — the vars may come from the shell
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (/^(".*"|'.*')$/s.test(value)) value = value.slice(1, -1);

    if (!(key in process.env)) process.env[key] = value;
  }
}

await loadEnvFile();

const PORT = Number(process.env.PORT || 4000);

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function handleSession(res) {
  const config = readConfig();
  try {
    await getAccessToken(config);
    return sendJson(res, 200, { ready: true, env: config.env, baseUrl: config.baseUrl });
  } catch (err) {
    return sendJson(res, err.status || 500, {
      ready: false,
      env: config.env,
      baseUrl: config.baseUrl,
      error: err.message,
    });
  }
}

async function handleTransactions(req, res) {
  try {
    const { status, body } = await searchTransactions(readConfig(), queryStringOf(req));
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(body || '{}');
  } catch (err) {
    return sendJson(res, err.status || 500, { error: err.message });
  }
}

async function sendFile(res, target) {
  const file = await fs.readFile(target);
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream',
    'Content-Length': file.length,
    'Cache-Control': target.endsWith('.html') ? 'no-cache' : 'public, max-age=3600',
  });
  res.end(file);
}

async function serveBuild(res, urlPath) {
  const relative = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  const target = path.resolve(DIST_DIR, relative);

  // Refuse anything that escapes the build directory.
  if (target !== DIST_DIR && !target.startsWith(DIST_DIR + path.sep)) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  try {
    return await sendFile(res, target);
  } catch {
    if (!path.extname(target)) {
      try {
        return await sendFile(res, path.join(DIST_DIR, 'index.html'));
      } catch {
        /* fall through */
      }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(
      'Not found.\n\nIf you expected the app here, build it first:\n  npm run build\n\n' +
        'Or run the dev server instead:\n  npm run dev   (app on http://localhost:5173)\n',
    );
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.pathname === '/api/session' && req.method === 'GET') {
      return await handleSession(res);
    }
    if (url.pathname === '/api/transactions' && req.method === 'GET') {
      return await handleTransactions(req, res);
    }
    if (url.pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: `No route for ${req.method} ${url.pathname}` });
    }
    if (req.method !== 'GET') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }
    return await serveBuild(res, url.pathname);
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  const config = readConfig();
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Monnify ${config.env} → ${config.baseUrl}`);
  if (!config.apiKey || !config.secretKey) {
    console.warn('⚠  MONNIFY_API_KEY / MONNIFY_SECRET_KEY are not set. Copy .env.example to .env.');
  }
});
