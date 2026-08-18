/**
 * Shared Monnify access layer.
 *
 * Used by the Vercel serverless functions in this directory and by server.js for
 * local development, so there is one implementation of the credential handling,
 * the token cache and the search call.
 *
 * The leading underscore keeps Vercel from turning this file into a route.
 */
import axios from 'axios';

const BASE_URLS = {
  sandbox: 'https://sandbox.monnify.com',
  live: 'https://api.monnify.com',
};

const LOGIN_PATH = '/api/v1/auth/login';
const V1_SEARCH_PATH = '/api/v1/transactions/search';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Read configuration from the environment on every call — on Vercel the values
 * are injected per invocation, and reading them late means a changed setting
 * takes effect without a redeploy of this module.
 */
export function readConfig() {
  const declared = String(process.env.MONNIFY_ENV || 'sandbox').toLowerCase();
  const baseUrl = process.env.BASE_URL || BASE_URLS[declared] || BASE_URLS.sandbox;

  // The label must follow the URL actually in use, so a BASE_URL override cannot
  // let the UI read "sandbox" while querying production.
  const matched = Object.entries(BASE_URLS).find(([, url]) => url === baseUrl);

  return {
    env: matched ? matched[0] : 'custom',
    baseUrl,
    apiKey: (process.env.MONNIFY_API_KEY || '').trim(),
    secretKey: (process.env.MONNIFY_SECRET_KEY || '').trim(),
  };
}

const client = axios.create({
  // Under Vercel's default 10s function limit, so a slow upstream produces our own
  // 502 with a readable message rather than Vercel's timeout page. Monnify
  // normally answers in ~1.5s. Raise this and maxDuration together if needed.
  timeout: 9_000,
  responseType: 'text', // keep the raw payload so it can be relayed untouched
  validateStatus: null, // never throw on 4xx/5xx — inspect and relay instead
  headers: { Accept: 'application/json' },
});

// Module scope, so a warm instance reuses its token. A cold start costs one
// sign-in. The cache key ties the token to the credentials that produced it.
let cached = null; // { key, value, expiresAt }
let pending = null; // dedupes concurrent sign-ins within one instance

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function signIn(config) {
  if (!config.apiKey || !config.secretKey) {
    throw new HttpError(
      503,
      'Monnify credentials are not configured. Set MONNIFY_API_KEY and MONNIFY_SECRET_KEY, then redeploy.',
    );
  }

  const credential = Buffer.from(`${config.apiKey}:${config.secretKey}`).toString('base64');

  let response;
  try {
    response = await client.post(`${config.baseUrl}${LOGIN_PATH}`, null, {
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

  // expiresIn is in seconds; renew a minute early so a search never races expiry.
  const lifetime = Number(payload.responseBody.expiresIn) || 3600;
  cached = {
    key: `${config.baseUrl}|${config.apiKey}`,
    value: token,
    expiresAt: Date.now() + Math.max(lifetime - 60, 30) * 1000,
  };
  return token;
}

export async function getAccessToken(config, { force = false } = {}) {
  const key = `${config.baseUrl}|${config.apiKey}`;
  if (!force && cached && cached.key === key && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  if (force) cached = null;

  if (!pending) {
    pending = signIn(config).finally(() => {
      pending = null;
    });
  }
  return pending;
}

/**
 * Run a v1 transaction search. Returns { status, body } with the upstream body as
 * a string, ready to relay verbatim.
 */
export async function searchTransactions(config, queryString) {
  const suffix = queryString ? `?${queryString}` : '';

  const call = (token, searchPath = V1_SEARCH_PATH) =>
    client.get(`${config.baseUrl}${searchPath}${suffix}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  try {
    let token = await getAccessToken(config);
    let response = await call(token);

    // The Postman collection uses both `/search` and `/search/`. Try the canonical
    // path first and fall back to the trailing-slash variant on a 404.
    if (response.status === 404) {
      response = await call(token, `${V1_SEARCH_PATH}/`);
    }

    // A token can be revoked before it expires; sign in again and retry once.
    if (response.status === 401) {
      token = await getAccessToken(config, { force: true });
      response = await call(token);
    }

    return { status: response.status, body: response.data };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const detail = err.code ? `${err.code}: ${err.message}` : err.message;
    throw new HttpError(502, `Could not reach Monnify — ${detail}`);
  }
}

/** Query string from a Node/Vercel request, preserving encoding exactly. */
export function queryStringOf(req) {
  const url = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  return url.searchParams.toString();
}
