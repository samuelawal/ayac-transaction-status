import { getAccessToken, readConfig } from './_monnify.js';

/**
 * GET /api/session
 * Confirms the deployment can authenticate, so the app shows a setup screen
 * instead of failing on the first search.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const config = readConfig();

  try {
    await getAccessToken(config);
    return res.status(200).json({ ready: true, env: config.env, baseUrl: config.baseUrl });
  } catch (err) {
    return res.status(err.status || 500).json({
      ready: false,
      env: config.env,
      baseUrl: config.baseUrl,
      error: err.message,
    });
  }
}
