import {
  exchangeCodeForTokens,
  getConfig,
  getRedirectUri,
  readOAuthState,
  setSessionCookie,
  clearOAuthStateCookie,
} from '../../lib/google-ads.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

  const config = getConfig();
  if (!config.ok) {
    return res.redirect(302, '/analisador.html?google_ads=error&msg=config');
  }

  const { code, state, error } = req.query || {};
  clearOAuthStateCookie(res);

  if (error) {
    return res.redirect(302, `/analisador.html?google_ads=error&msg=${encodeURIComponent(error)}`);
  }

  const savedState = readOAuthState(req);
  if (!code || !state || state !== savedState) {
    return res.redirect(302, '/analisador.html?google_ads=error&msg=state');
  }

  try {
    const tokens = await exchangeCodeForTokens({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      redirectUri: getRedirectUri(req),
    });

    setSessionCookie(res, tokens.refresh_token, config.sessionSecret, [
      'gads_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    ]);
    return res.redirect(302, '/analisador.html?google_ads=connected');
  } catch (err) {
    return res.redirect(302, `/analisador.html?google_ads=error&msg=${encodeURIComponent(err.message)}`);
  }
}
