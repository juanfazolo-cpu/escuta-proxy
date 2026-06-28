import { clearSessionCookie, cookieOptions, cors } from '../../lib/google-ads.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  clearSessionCookie(res, cookieOptions(req));
  return res.status(200).json({ ok: true });
}
