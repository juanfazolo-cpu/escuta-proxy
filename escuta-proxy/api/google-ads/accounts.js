import {
  cors,
  fetchCustomerName,
  formatCustomerId,
  getAuthorizedContext,
  listAccessibleCustomers,
} from '../../lib/google-ads.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

  try {
    const auth = await getAuthorizedContext(req);
    if (auth.error) return res.status(auth.error.includes('não conectada') ? 401 : 503).json({ error: auth.error });

    const ids = await listAccessibleCustomers({
      accessToken: auth.accessToken,
      developerToken: auth.config.developerToken,
      loginCustomerId: auth.config.loginCustomerId,
    });

    const accounts = await Promise.all(
      ids.slice(0, 25).map(async (id) => {
        try {
          const name = await fetchCustomerName({
            accessToken: auth.accessToken,
            developerToken: auth.config.developerToken,
            loginCustomerId: auth.config.loginCustomerId,
            customerId: id,
          });
          return { id, formatted_id: formatCustomerId(id), name };
        } catch {
          return { id, formatted_id: formatCustomerId(id), name: `Conta ${formatCustomerId(id)}` };
        }
      })
    );

    return res.status(200).json({ connected: true, accounts });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
