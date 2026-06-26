const OBJECTIVES = {
  conversoes: 'Conversões (compras, cadastros, ações no site)',
  trafego: 'Tráfego qualificado para o site ou landing page',
  leads: 'Geração de leads (formulários, ligações, contatos)',
  youtube: 'YouTube / vídeo (visualizações, engajamento em vídeo)',
  reconhecimento: 'Reconhecimento de marca (alcance e impressões)',
  vendas: 'Vendas com ROAS positivo (performance máxima)',
};

const GOOGLE_CAMPAIGN_TYPES = {
  search: 'Rede de Pesquisa',
  display: 'Display (GDN)',
  youtube: 'YouTube',
  pmax: 'Performance Max',
  demand_gen: 'Demand Gen',
  outros: 'Outro / misto',
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function num(value) {
  if (value === null || value === undefined || value === '') return 0;
  const raw = String(value).trim();
  const pct = raw.includes('%');
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(',', '.');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return pct && n > 0 && n <= 100 ? n : n;
}

function computeBenchmarks(campaigns, objetivo) {
  const totals = campaigns.reduce(
    (acc, c) => {
      acc.spend += num(c.spend);
      acc.impressions += num(c.impressions);
      acc.clicks += num(c.clicks);
      acc.conversions += num(c.conversions);
      acc.revenue += num(c.revenue);
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
  );

  const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks ? totals.spend / totals.clicks : 0;
  const cpa = totals.conversions ? totals.spend / totals.conversions : 0;
  const cvr = totals.clicks ? (totals.conversions / totals.clicks) * 100 : 0;
  const roas = totals.spend && totals.revenue ? totals.revenue / totals.spend : 0;

  const withImpressionShare = campaigns.filter((c) => num(c.impressionShare) > 0);
  const avgImpressionShare = withImpressionShare.length
    ? withImpressionShare.reduce((s, c) => s + num(c.impressionShare), 0) / withImpressionShare.length
    : 0;

  const flags = [];
  const searchCampaigns = campaigns.filter((c) => c.tipo === 'search');
  const displayCampaigns = campaigns.filter((c) => c.tipo === 'display');

  if (searchCampaigns.length) {
    const searchCtr =
      searchCampaigns.reduce((s, c) => s + num(c.clicks), 0) /
      Math.max(
        searchCampaigns.reduce((s, c) => s + num(c.impressions), 0),
        1
      ) *
      100;
    if (searchCtr < 2 && totals.impressions > 500) {
      flags.push('CTR baixo em campanhas de Pesquisa (< 2% — revisar anúncios e palavras-chave)');
    }
    if (avgImpressionShare > 0 && avgImpressionShare < 50) {
      flags.push(`Parcela de impressões na Pesquisa baixa (${avgImpressionShare.toFixed(0)}% — orçamento ou lance limitando alcance)`);
    }
  }

  if (displayCampaigns.length) {
    const displayCtr =
      displayCampaigns.reduce((s, c) => s + num(c.clicks), 0) /
      Math.max(displayCampaigns.reduce((s, c) => s + num(c.impressions), 0), 1) *
      100;
    if (displayCtr < 0.35 && totals.impressions > 2000) {
      flags.push('CTR baixo em Display (< 0,35% — criativos ou segmentação fraca)');
    }
  }

  if (totals.clicks > 100 && cvr < 1 && ['conversoes', 'leads', 'vendas'].includes(objetivo)) {
    flags.push('Taxa de conversão pós-clique baixa (< 1% — revisar landing page ou tracking)');
  }

  if (totals.spend > 50 && totals.conversions === 0 && ['conversoes', 'leads', 'vendas'].includes(objetivo)) {
    flags.push('Gasto sem conversões — verificar tag do Google Ads, eventos de conversão e janela de atribuição');
  }

  if (objetivo === 'vendas' && totals.spend > 100 && roas > 0 && roas < 1) {
    flags.push(`ROAS abaixo de 1 (${roas.toFixed(2)}x — campanha no prejuízo)`);
  }

  if (cpc > 0 && totals.clicks > 30 && ctr > 3 && cvr < 0.5) {
    flags.push('CTR bom mas conversão fraca — problema provável na LP ou na intenção das palavras-chave');
  }

  return { totals, ctr, cpc, cpa, cvr, roas, avgImpressionShare, flags };
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { objetivo, campaigns, contexto, periodo, tipo_conta } = req.body || {};
  const plataforma = 'google';

  if (!objetivo || !OBJECTIVES[objetivo]) {
    return res.status(400).json({ error: 'Objetivo inválido ou ausente' });
  }
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    return res.status(400).json({ error: 'Adicione pelo menos uma campanha com métricas' });
  }

  const normalized = campaigns.map((c, i) => ({
    nome: c.nome || `Campanha ${i + 1}`,
    tipo: GOOGLE_CAMPAIGN_TYPES[c.tipo] ? c.tipo : 'outros',
    tipoLabel: GOOGLE_CAMPAIGN_TYPES[c.tipo] || GOOGLE_CAMPAIGN_TYPES.outros,
    status: c.status || 'ativa',
    spend: num(c.spend),
    impressions: num(c.impressions),
    clicks: num(c.clicks),
    conversions: num(c.conversions),
    revenue: num(c.revenue),
    impressionShare: num(c.impressionShare),
    qualityScore: num(c.qualityScore),
  }));

  const benchmarks = computeBenchmarks(normalized, objetivo);
  const objectiveLabel = OBJECTIVES[objetivo];

  const campaignSummary = normalized
    .map((c) => {
      const ctr = c.impressions ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0';
      const cpc = c.clicks ? (c.spend / c.clicks).toFixed(2) : '—';
      const cpa = c.conversions ? (c.spend / c.conversions).toFixed(2) : '—';
      const roas = c.spend && c.revenue ? (c.revenue / c.spend).toFixed(2) : '—';
      const is = c.impressionShare ? `${c.impressionShare}%` : '—';
      const qs = c.qualityScore ? c.qualityScore : '—';
      return `- [${c.tipoLabel}] ${c.nome} | R$ ${c.spend.toFixed(2)} | ${c.impressions} imp | ${c.clicks} cliques | CTR ${ctr}% | CPC R$ ${cpc} | ${c.conversions} conv | CPA R$ ${cpa} | ROAS ${roas} | Parcela impr. ${is} | QS ${qs}`;
    })
    .join('\n');

  const prompt = `Você é um especialista sênior em Google Ads (Search, Display, YouTube, Performance Max, Demand Gen).
Analise as campanhas abaixo com foco no objetivo: ${objectiveLabel}.

PERÍODO: ${periodo || 'não informado'}
TIPO DE CONTA / NICHO: ${tipo_conta || contexto || 'não informado'}
CONTEXTO ADICIONAL: ${contexto || 'não informado'}

MÉTRICAS AGREGADAS (Google Ads):
- Gasto total: R$ ${benchmarks.totals.spend.toFixed(2)}
- Impressões: ${benchmarks.totals.impressions}
- Cliques: ${benchmarks.totals.clicks}
- CTR médio: ${benchmarks.ctr.toFixed(2)}%
- CPC médio: R$ ${benchmarks.cpc.toFixed(2)}
- Conversões: ${benchmarks.totals.conversions}
- CPA médio: ${benchmarks.cpa ? `R$ ${benchmarks.cpa.toFixed(2)}` : 'sem dados'}
- Taxa de conversão (clique→conv): ${benchmarks.cvr.toFixed(2)}%
- ROAS: ${benchmarks.roas ? `${benchmarks.roas.toFixed(2)}x` : 'sem dados de receita'}
- Parcela média de impressões (Pesquisa): ${benchmarks.avgImpressionShare ? `${benchmarks.avgImpressionShare.toFixed(1)}%` : 'não informada'}
- Alertas automáticos: ${benchmarks.flags.length ? benchmarks.flags.join('; ') : 'nenhum'}

CAMPANHAS:
${campaignSummary}

Responda SOMENTE com JSON válido (sem markdown), neste formato:
{
  "score": 0-100,
  "resumo": "2-3 frases diretas sobre saúde geral da conta Google Ads",
  "diagnostico": {
    "funciona": ["item específico com número"],
    "nao_funciona": ["item específico com número"],
    "incerto": ["o que falta medir ou amostra pequena"]
  },
  "recomendacoes": [
    {
      "prioridade": "alta|media|baixa",
      "acao": "ação concreta no Google Ads",
      "motivo": "por que, com base nas métricas",
      "impacto_esperado": "o que deve melhorar"
    }
  ],
  "testes_ab": [
    {
      "hipotese": "o que testar",
      "variantes": ["A", "B"],
      "metrica": "métrica principal",
      "duracao_sugerida": "ex: 7 dias ou 50 conversões"
    }
  ],
  "orcamento": {
    "pausar": ["campanhas ou grupos a pausar"],
    "escalar": ["campanhas ou grupos a escalar"],
    "realocar": "sugestão de redistribuição em %"
  },
  "google_ads_especifico": {
    "palavras_chave": ["sugestões de otimização de keywords, correspondência, negativas"],
    "lances": ["sugestões de estratégia de lance / Smart Bidding"],
    "estrutura": ["sugestões de campanha, grupos de anúncios, extensões"],
    "tracking": ["verificações de conversão, GA4, tag"]
  },
  "proximos_passos": ["3 ações para fazer hoje no painel do Google Ads, em ordem"]
}

Regras:
- Fale como consultor Google Ads, não genérico.
- Diferencie recomendações para Search vs Display vs PMax quando aplicável.
- Mencione extensões de anúncio, palavras-chave negativas, Quality Score e parcela de impressões quando relevante.
- Se faltar conversão/tag, priorize diagnóstico de tracking antes de otimizar criativo.
- Objetivo da análise: "${objetivo}".
- Máximo 5 recomendações, 3 testes A/B.
- Português brasileiro, tom direto.`;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY não configurada no servidor',
      benchmarks,
      campaigns: normalized,
    });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const apiError = data.error?.message || data.error?.type || 'Erro na API Anthropic';
      return res.status(response.status).json({
        error: apiError,
        detail: data.error || null,
        benchmarks,
      });
    }

    const rawText = (data.content || []).map((b) => b.text || '').join('');
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON não encontrado na resposta da IA');

    const analysis = JSON.parse(jsonMatch[0]);
    return res.status(200).json({
      analysis,
      benchmarks,
      meta: { plataforma, objetivo, periodo, campaignCount: normalized.length },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, benchmarks });
  }
}
