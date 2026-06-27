import crypto from 'crypto';
import {
  buildAuthUrl,
  clearOAuthStateCookie,
  getConfig,
  getRedirectUri,
  setOAuthStateCookie,
} from '../../lib/google-ads.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

  const config = getConfig();
  if (!config.ok) {
    return res.status(503).json({ error: config.error });
  }

  const state = crypto.randomBytes(16).toString('hex');
  setOAuthStateCookie(res, state);

  const url = buildAuthUrl({
    clientId: config.clientId,
    redirectUri: getRedirectUri(req),
    state,
  });

  return res.redirect(302, url);
}
