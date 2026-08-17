/**
 * API proxy for the AYAC transaction-status app, plus static serving of the build.
 *
 * The server owns the Monnify credentials (from .env) and signs itself in. The browser
 * never sees the API key, the secret key, or the access token — it just asks this
 * server for transactions.
 *
 * In development Vite serves the app on :5173 and forwards /api here.
 * In production `npm run build` writes dist/ and this server serves it too.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(ROOT, 'dist');

const V1_SEARCH_PATH = '/api/v1/transactions/search';
const LOGIN_PATH = '/api/v1/auth/login';

const BASE_URLS = {
  sandbox: 'https://sandbox.monnify.com',
  live: 'https://api.monnify.com',
};

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

// ─────────────────────────── config ───────────────────────────

/** Minimal .env reader. Real environment variables always win. */
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

const config = {
  env: String(process.env.MONNIFY_ENV || 'sandbox').toLowerCase(),
  apiKey: (process.env.MONNIFY_API_KEY || '').trim(),
  secretKey: (process.env.MONNIFY_SECRET_KEY || '').trim(),
  port: Number(process.env.PORT || 4000),
};

if (!BASE_URLS[config.env]) {
  console.warn(`MONNIFY_ENV="${config.env}" is not recognised — falling back to sandbox.`);
  config.env = 'sandbox';
}
const BASE_URL = process.env.BASE_URL || BASE_URLS[config.env];

// The label the UI displays must follow the URL actually in use. Without this, a
// BASE_URL override would let the header read "sandbox" while querying production.
const matchedEnv = Object.entries(BASE_URLS).find(([, url]) => url === BASE_URL);
config.env = matchedEnv ? matchedEnv[0] : 'custom';

// ─────────────────────────── upstream ───────────────────────────

// One client for every Monnify call. `validateStatus` is disabled so a 4xx (bad
// credentials, expired token) can be inspected here instead of thrown away.
const monnify = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  responseType: 'text', // keep the raw payload so it can be relayed untouched
  validateStatus: null,
  headers: { Accept: 'application/json' },
});

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let cachedToken = null; // { value, expiresAt }
let pendingLogin = null; // dedupes concurrent sign-ins

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function signIn() {
  if (!config.apiKey || !config.secretKey) {
    throw new HttpError(
      503,
      'Monnify credentials are not configured. Set MONNIFY_API_KEY and MONNIFY_SECRET_KEY in .env, then restart the server.',
    );
  }

  const credential = Buffer.from(`${config.apiKey}:${config.secretKey}`).toString('base64');

  let response;
  try {
    response = await monnify.post(LOGIN_PATH, null, {
      headers: { Authorization: `Basic ${credential}`, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const detail = err.code ? `${err.code}: ${err.message}` : err.message;
    throw new HttpError(502, `Could not reach Monnify — ${detail}`);
  }

  const payload = parseJson(response.data);
  const token = payload?.responseBody?.accessToken;

  if (!payload?.requestSuccessful || !token) {
    throw new HttpError(
      response.status === 200 ? 502 : response.status,
      payload?.responseMessage || `Monnify rejected the credentials (HTTP ${response.status}).`,
    );
  }

  // expiresIn is in seconds; renew a minute early so a search never races the expiry.
  const lifetime = Number(payload.responseBody.expiresIn) || 3600;
  cachedToken = { value: token, expiresAt: Date.now() + Math.max(lifetime - 60, 30) * 1000 };
  console.log(`Signed in to Monnify ${config.env}; token valid for ${lifetime}s.`);
  return cachedToken.value;
}

/** Cached access token, signing in (once, even under concurrency) when needed. */
async function getAccessToken({ force = false } = {}) {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  if (force) cachedToken = null;

  if (!pendingLogin) {
    pendingLogin = signIn().finally(() => {
      pendingLogin = null;
    });
  }
  return pendingLogin;
}

// ─────────────────────────── responses ───────────────────────────

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/** Forward a Monnify response to the browser, keeping its status and body. */
function relay(res, upstream) {
  const body =
    typeof upstream.data === 'string' ? upstream.data : JSON.stringify(upstream.data ?? {});
  res.writeHead(upstream.status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body || '{}');
}

// ─────────────────────────── routes ───────────────────────────

/**
 * GET /api/session
 * Confirms the server can authenticate, so the app can show a setup screen instead
 * of failing on the first search.
 */
async function handleSession(res) {
  try {
    await getAccessToken();
    return sendJson(res, 200, { ready: true, env: config.env, baseUrl: BASE_URL });
  } catch (err) {
    return sendJson(res, err.status || 500, {
      ready: false,
      env: config.env,
      baseUrl: BASE_URL,
      error: err.message,
    });
  }
}

/**
 * GET /api/transactions?<v1 search params>
 * -> Monnify GET /api/v1/transactions/search with the server's Bearer token.
 */
async function handleTransactions(res, url) {
  const query = url.searchParams.toString();

  const call = (token, searchPath = V1_SEARCH_PATH) =>
    monnify.get(`${searchPath}${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  try {
    let token = await getAccessToken();
    let upstream = await call(token);

    // The collection uses both `/search` and `/search/`. Try the canonical path
    // first and fall back to the trailing-slash variant if it 404s.
    if (upstream.status === 404) {
      upstream = await call(token, `${V1_SEARCH_PATH}/`);
    }

    // A token can be revoked before it expires; sign in again and retry once.
    if (upstream.status === 401) {
      token = await getAccessToken({ force: true });
      upstream = await call(token);
    }

    return relay(res, upstream);
  } catch (err) {
    if (err instanceof HttpError) {
      return sendJson(res, err.status, { error: err.message });
    }
    const detail = err.code ? `${err.code}: ${err.message}` : err.message;
    return sendJson(res, 502, { error: `Could not reach Monnify — ${detail}` });
  }
}

// ─────────────────────────── static ───────────────────────────

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
    // Unknown path with no extension: hand back the SPA shell.
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

// ─────────────────────────── server ───────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.pathname === '/api/session' && req.method === 'GET') {
      return await handleSession(res);
    }
    if (url.pathname === '/api/transactions' && req.method === 'GET') {
      return await handleTransactions(res, url);
    }
    if (url.pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: `No proxy route for ${req.method} ${url.pathname}` });
    }
    if (req.method !== 'GET') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }
    return await serveBuild(res, url.pathname);
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
});

server.listen(config.port, () => {
  const configured = config.apiKey && config.secretKey;
  console.log(`API proxy listening on http://localhost:${config.port}`);
  console.log(`Monnify ${config.env} → ${BASE_URL}`);
  if (!configured) {
    console.warn('⚠  MONNIFY_API_KEY / MONNIFY_SECRET_KEY are not set. Copy .env.example to .env.');
  }
});
