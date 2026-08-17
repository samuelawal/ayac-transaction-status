import axios from 'axios';

/**
 * Both calls go to the local Node proxy, which holds the Monnify credentials and
 * signs itself in. No key, secret, or access token is ever handled in the browser.
 *
 *   GET /api/session      -> can the server authenticate? which environment?
 *   GET /api/transactions -> Monnify GET /api/v1/transactions/search
 */
const client = axios.create({
  timeout: 35_000,
  // Match the proxy's serialization exactly, so the query string previewed in the
  // UI is the one that actually goes out (`|` -> %7C, `@` -> %40).
  paramsSerializer: (params) => new URLSearchParams(params).toString(),
});

/** A Monnify envelope that came back with requestSuccessful: false. */
export class MonnifyError extends Error {
  constructor(envelope) {
    super(envelope?.responseMessage || envelope?.error || 'Request was not successful.');
    this.name = 'MonnifyError';
    this.envelope = envelope;
  }
}

/**
 * Ask the server whether it is configured and signed in.
 * Returns { ready, env, baseUrl, error } either way — a 503 here means the
 * credentials are missing or wrong, which the app shows as a setup screen.
 */
export async function fetchSession() {
  try {
    const { data } = await client.get('/api/session');
    return data;
  } catch (error) {
    const data = error?.response?.data;
    if (data && typeof data === 'object') return { ready: false, ...data };
    return { ready: false, error: error.message || 'Could not reach the server.' };
  }
}

/** Run a v1 transaction search. Returns the Spring page object (responseBody). */
export async function searchTransactions(params) {
  const { data } = await client.get('/api/transactions', { params });

  if (data?.requestSuccessful === false) {
    throw new MonnifyError(data);
  }
  return data?.responseBody ?? null;
}
