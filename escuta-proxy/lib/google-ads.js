import crypto from 'crypto';

export const API_VERSION = 'v18';
export const OAUTH_SCOPE = 'https://www.googleapis.com/auth/adwords';

const CHANNEL_TO_TIPO = {
  SEARCH: 'search',
  PERFORMANCE_MAX: 'pmax',
  DISPLAY: 'display',
  VIDEO: 'youtube',
  SHOPPING: 'search',
  SMART: 'outros',
  LOCAL: 'search',
  HOTEL: 'outros',
  DEMAND_GEN: 'outros',
  MULTI_CHANNEL: 'pmax',
};

export function cors(res, methods = 'GET, POST, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function getConfig() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const sessionSecret = process.env.GOOGLE_ADS_SESSION_SECRET || process.env.ANTHROPIC_API_KEY || 'change-me';

  if (!clientId || !clientSecret || !developerToken) {
    return {
      ok: false,
      error:
        'Google Ads API não configurada. Defina GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET e GOOGLE_ADS_DEVELOPER_TOKEN no arquivo .env.',
    };
  }

  return {
    ok: true,
    clientId,
    clientSecret,
    developerToken,
    sessionSecret,
    loginCustomerId: (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/\D/g, '') || null,
  };
}

export function getRedirectUri(req) {
  if (process.env.GOOGLE_ADS_REDIRECT_URI) return process.env.GOOGLE_ADS_REDIRECT_URI;
  if (process.env.PUBLIC_URL) {
    return `${process.env.PUBLIC_URL.replace(/\/$/, '')}/api/google-ads/callback`;
  }
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const secure = cookieOptions(req).secure;
  const proto = req.headers['x-forwarded-proto'] || (secure ? 'https' : 'http');
  return `${proto}://${host}/api/google-ads/callback`;
}

export function cookieOptions(req) {
  const forced = process.env.COOKIE_SECURE;
  if (forced === 'true') return { secure: true };
  if (forced === 'false') return { secure: false };

  const proto = req?.headers?.['x-forwarded-proto'];
  if (proto) return { secure: proto === 'https' };

  const host = String(req?.headers?.host || '');
  const local = host.includes('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
  return { secure: !local };
}

function cookieFlags(options = {}) {
  return `Path=/; HttpOnly; SameSite=Lax${options.secure ? '; Secure' : ''}`;
}

export function normalizeCustomerId(id) {
  return String(id || '').replace(/\D/g, '');
}

export function formatCustomerId(id) {
  const digits = normalizeCustomerId(id);
  if (digits.length !== 10) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function signPayload(payload, secret) {
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${Buffer.from(data).toString('base64url')}.${sig}`;
}

function verifyPayload(token, secret) {
  const [dataB64, sig] = String(token || '').split('.');
  if (!dataB64 || !sig) throw new Error('Sessão inválida');
  const data = Buffer.from(dataB64, 'base64url').toString();
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (sig !== expected) throw new Error('Sessão inválida');
  return JSON.parse(data);
}

const COOKIE_NAME = 'gads_session';
const STATE_COOKIE = 'gads_oauth_state';

export function setSessionCookie(res, refreshToken, secret, extraCookies = [], options = {}) {
  const token = signPayload({ refresh_token: refreshToken, at: Date.now() }, secret);
  const flags = cookieFlags(options);
  const cookies = [
    `${COOKIE_NAME}=${token}; ${flags}; Max-Age=${60 * 60 * 24 * 30}`,
    ...extraCookies,
  ];
  res.setHeader('Set-Cookie', cookies);
}

export function clearSessionCookie(res, options = {}) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${cookieFlags(options)}; Max-Age=0`);
}

export function getRefreshToken(req, secret) {
  const raw = parseCookies(req)[COOKIE_NAME];
  if (!raw) return null;
  const payload = verifyPayload(raw, secret);
  return payload.refresh_token || null;
}

export function setOAuthStateCookie(res, state, options = {}) {
  res.setHeader('Set-Cookie', `${STATE_COOKIE}=${state}; ${cookieFlags(options)}; Max-Age=600`);
}

export function readOAuthState(req) {
  return parseCookies(req)[STATE_COOKIE] || null;
}

export function clearOAuthStateCookie(res, options = {}) {
  res.setHeader('Set-Cookie', expiredStateCookie(options));
}

export function expiredStateCookie(options = {}) {
  return `${STATE_COOKIE}=; ${cookieFlags(options)}; Max-Age=0`;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const i = part.indexOf('=');
        return i === -1 ? [part, ''] : [part.slice(0, i), decodeURIComponent(part.slice(i + 1))];
      })
  );
}

export function buildAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: OAUTH_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens({ clientId, clientSecret, code, redirectUri }) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Falha ao obter token OAuth');
  }
  if (!data.refresh_token) {
    throw new Error('Google não devolveu refresh_token. Revogue o acesso em myaccount.google.com/permissions e conecte de novo.');
  }
  return data;
}

export async function getAccessToken({ clientId, clientSecret, refreshToken }) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Falha ao renovar token');
  }
  return data.access_token;
}

function adsHeaders({ accessToken, developerToken, loginCustomerId }) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  };
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;
  return headers;
}

async function parseAdsError(response, data) {
  const detail =
    data?.error?.details?.[0]?.errors?.[0]?.message ||
    data?.error?.message ||
    data?.[0]?.error?.message ||
    'Erro na API Google Ads';
  throw new Error(`${detail} (HTTP ${response.status})`);
}

export async function listAccessibleCustomers({ accessToken, developerToken, loginCustomerId }) {
  const response = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`, {
    headers: adsHeaders({ accessToken, developerToken, loginCustomerId }),
  });
  const data = await response.json();
  if (!response.ok) await parseAdsError(response, data);
  return (data.resourceNames || []).map((name) => name.replace('customers/', ''));
}

export async function searchStream({ accessToken, developerToken, loginCustomerId, customerId, query }) {
  const id = normalizeCustomerId(customerId);
  const response = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${id}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: adsHeaders({ accessToken, developerToken, loginCustomerId }),
      body: JSON.stringify({ query }),
    }
  );
  const data = await response.json();
  if (!response.ok) await parseAdsError(response, data);

  const rows = [];
  for (const chunk of data || []) {
    for (const row of chunk.results || []) rows.push(row);
  }
  return rows;
}

export async function fetchCustomerName({ accessToken, developerToken, loginCustomerId, customerId }) {
  const rows = await searchStream({
    accessToken,
    developerToken,
    loginCustomerId,
    customerId,
    query: 'SELECT customer.descriptive_name, customer.id FROM customer LIMIT 1',
  });
  const customer = rows[0]?.customer;
  return customer?.descriptiveName || customer?.descriptive_name || `Conta ${formatCustomerId(customerId)}`;
}

export function dateClause(periodo) {
  const map = {
    '7': 'LAST_7_DAYS',
    '14': 'LAST_14_DAYS',
    '30': 'LAST_30_DAYS',
    '90': 'LAST_90_DAYS',
  };
  return map[String(periodo)] || 'LAST_30_DAYS';
}

export function periodLabel(periodo) {
  const map = {
    '7': 'últimos 7 dias',
    '14': 'últimos 14 dias',
    '30': 'últimos 30 dias',
    '90': 'últimos 90 dias',
  };
  return map[String(periodo)] || 'últimos 30 dias';
}

function microsToUnits(value) {
  const n = Number(value || 0);
  return n / 1_000_000;
}

function mapChannelType(row) {
  const channel =
    row.campaign?.advertisingChannelType ||
    row.campaign?.advertising_channel_type ||
    '';
  return CHANNEL_TO_TIPO[channel] || 'outros';
}

export function mapCampaignRows(rows) {
  const byKey = new Map();

  for (const row of rows) {
    const campaign = row.campaign || {};
    const metrics = row.metrics || {};
    const id = campaign.id || campaign.resourceName || campaign.name;
    const key = String(id);

    if (!byKey.has(key)) {
      byKey.set(key, {
        nome: campaign.name || `Campanha ${id}`,
        tipo: mapChannelType(row),
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
        impressionShare: 0,
        _shareWeighted: 0,
      });
    }

    const item = byKey.get(key);
    const impressions = Number(metrics.impressions || 0);
    item.spend += microsToUnits(metrics.costMicros ?? metrics.cost_micros);
    item.impressions += impressions;
    item.clicks += Number(metrics.clicks || 0);
    item.conversions += Number(metrics.conversions || 0);
    item.revenue += microsToUnits(metrics.conversionsValue ?? metrics.conversions_value);

    const share = Number(metrics.searchImpressionShare ?? metrics.search_impression_share ?? 0);
    if (share > 0 && impressions > 0) {
      item._shareWeighted += share * impressions;
      item.impressionShare = item._shareWeighted / item.impressions;
    }
  }

  return [...byKey.values()].map(({ _shareWeighted, ...campaign }) => ({
    ...campaign,
    impressionShare: campaign.impressionShare ? (campaign.impressionShare * 100).toFixed(1) : '',
  }));
}

export async function getAuthorizedContext(req) {
  const config = getConfig();
  if (!config.ok) return { config, error: config.error };

  const refreshToken = getRefreshToken(req, config.sessionSecret);
  if (!refreshToken) {
    return {
      config,
      error: 'Conta Google Ads não conectada. Clique em "Conectar Google Ads" primeiro.',
    };
  }

  const accessToken = await getAccessToken({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken,
  });

  return { config, accessToken, refreshToken };
}
