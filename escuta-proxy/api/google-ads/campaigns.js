import {
  cors,
  dateClause,
  getAuthorizedContext,
  mapCampaignRows,
  normalizeCustomerId,
  periodLabel,
  searchStream,
} from '../../lib/google-ads.js';

const CAMPAIGN_QUERY = (dateFilter) => `
  SELECT
    campaign.id,
    campaign.name,
    campaign.advertising_channel_type,
    metrics.cost_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.conversions_value,
    metrics.search_impression_share
  FROM campaign
  WHERE segments.date DURING ${dateFilter}
    AND campaign.status != 'REMOVED'
`;

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const { customer_id, periodo = '30' } = req.body || {};
  const customerId = normalizeCustomerId(customer_id);

  if (!customerId) {
    return res.status(400).json({ error: 'Informe o ID da conta Google Ads' });
  }

  try {
    const auth = await getAuthorizedContext(req);
    if (auth.error) return res.status(auth.error.includes('não conectada') ? 401 : 503).json({ error: auth.error });

    const dateFilter = dateClause(periodo);
    const rows = await searchStream({
      accessToken: auth.accessToken,
      developerToken: auth.config.developerToken,
      loginCustomerId: auth.config.loginCustomerId,
      customerId,
      query: CAMPAIGN_QUERY(dateFilter),
    });

    const campaigns = mapCampaignRows(rows).filter(
      (c) => c.spend > 0 || c.clicks > 0 || c.impressions > 0 || c.conversions > 0
    );

    if (!campaigns.length) {
      return res.status(404).json({
        error: 'Nenhuma campanha com dados no período. Verifique se a conta está correta e se há campanhas ativas.',
      });
    }

    return res.status(200).json({
      customer_id: customerId,
      periodo: periodLabel(periodo),
      fonte: 'google_ads_api',
      total: campaigns.length,
      campaigns,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
