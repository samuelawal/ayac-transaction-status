import { queryStringOf, readConfig, searchTransactions } from './_monnify.js';

/**
 * GET /api/transactions?<v1 search params>
 * -> Monnify GET /api/v1/transactions/search, authenticated server-side.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { status, body } = await searchTransactions(readConfig(), queryStringOf(req));
    res.status(status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(body || '{}');
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
