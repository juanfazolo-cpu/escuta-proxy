import {
  exchangeCodeForTokens,
  cookieOptions,
  clearOAuthStateCookie,
  expiredStateCookie,
  getConfig,
  getRedirectUri,
  readOAuthState,
  setSessionCookie,
} from '../../lib/google-ads.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

  const config = getConfig();
  if (!config.ok) {
    return res.redirect(302, '/analisador.html?google_ads=error&msg=config');
  }

  const { code, state, error } = req.query || {};
  const opts = cookieOptions(req);

  if (error) {
    clearOAuthStateCookie(res, opts);
    return res.redirect(302, `/analisador.html?google_ads=error&msg=${encodeURIComponent(error)}`);
  }

  const savedState = readOAuthState(req);
  if (!code || !state || state !== savedState) {
    clearOAuthStateCookie(res, opts);
    return res.redirect(302, '/analisador.html?google_ads=error&msg=state');
  }

  try {
    const tokens = await exchangeCodeForTokens({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      redirectUri: getRedirectUri(req),
    });

    setSessionCookie(res, tokens.refresh_token, config.sessionSecret, [expiredStateCookie(opts)], opts);
    return res.redirect(302, '/analisador.html?google_ads=connected');
  } catch (err) {
    return res.redirect(302, `/analisador.html?google_ads=error&msg=${encodeURIComponent(err.message)}`);
  }
}
