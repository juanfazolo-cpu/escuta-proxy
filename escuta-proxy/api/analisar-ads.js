const OBJECTIVES = {
  conversoes: 'Conversões (compras, cadastros, ações no site)',
  trafego: 'Tráfego qualificado para o site ou landing page',
  leads: 'Geração de leads (formulários, WhatsApp, contatos)',
  engajamento: 'Engajamento (curtidas, comentários, salvamentos, vídeo)',
  reconhecimento: 'Reconhecimento de marca (alcance e frequência controlada)',
  vendas: 'Vendas com ROAS positivo (performance máxima)',
};

const PLATFORMS = {
  meta: 'Meta Ads (Facebook / Instagram)',
  google: 'Google Ads (Search, Display, YouTube, PMax)',
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function computeBenchmarks(campaigns, objetivo) {
  const totals = campaigns.reduce(
    (acc, c) => {
      acc.spend += num(c.spend);
      acc.impressions += num(c.impressions);
      acc.clicks += num(c.clicks);
      acc.conversions += num(c.conversions);
      acc.reach += num(c.reach);
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, reach: 0 }
  );

  const ctr = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks ? totals.spend / totals.clicks : 0;
  const cpa = totals.conversions ? totals.spend / totals.conversions : 0;
  const cvr = totals.clicks ? (totals.conversions / totals.clicks) * 100 : 0;
  const avgFrequency =
    campaigns.length && totals.reach
      ? campaigns.reduce((s, c) => s + num(c.frequency), 0) / campaigns.length
      : totals.reach
        ? totals.impressions / totals.reach
        : 0;

  const flags = [];
  if (ctr < 0.8 && totals.impressions > 1000) flags.push('CTR abaixo do esperado para Meta (< 0,8%)');
  if (ctr < 2 && totals.impressions > 500) flags.push('CTR baixo para Google Search (< 2%)');
  if (avgFrequency > 3.5) flags.push('Frequência alta — risco de fadiga criativa');
  if (objetivo === 'vendas' && cpa > 0 && totals.spend > 100 && cvr < 1) {
    flags.push('Taxa de conversão baixa para campanha de vendas');
  }
  if (totals.spend > 50 && totals.conversions === 0 && ['conversoes', 'leads', 'vendas'].includes(objetivo)) {
    flags.push('Gasto sem conversões registradas');
  }

  return { totals, ctr, cpc, cpa, cvr, avgFrequency, flags };
}

function num(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(String(value).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { plataforma, objetivo, campaigns, contexto, periodo } = req.body || {};

  if (!objetivo || !OBJECTIVES[objetivo]) {
    return res.status(400).json({ error: 'Objetivo inválido ou ausente' });
  }
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    return res.status(400).json({ error: 'Adicione pelo menos uma campanha com métricas' });
  }

  const normalized = campaigns.map((c, i) => ({
    nome: c.nome || `Campanha ${i + 1}`,
    status: c.status || 'ativa',
    spend: num(c.spend),
    impressions: num(c.impressions),
    clicks: num(c.clicks),
    conversions: num(c.conversions),
    reach: num(c.reach),
    frequency: num(c.frequency),
    revenue: num(c.revenue),
  }));

  const benchmarks = computeBenchmarks(normalized, objetivo);
  const platformLabel = PLATFORMS[plataforma] || plataforma || 'Não informada';
  const objectiveLabel = OBJECTIVES[objetivo];

  const campaignSummary = normalized
    .map((c) => {
      const ctr = c.impressions ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0';
      const cpc = c.clicks ? (c.spend / c.clicks).toFixed(2) : '—';
      const cpa = c.conversions ? (c.spend / c.conversions).toFixed(2) : '—';
      const roas = c.spend && c.revenue ? (c.revenue / c.spend).toFixed(2) : '—';
      return `- ${c.nome} | R$ ${c.spend.toFixed(2)} gastos | ${c.impressions} imp | ${c.clicks} cliques | CTR ${ctr}% | CPC R$ ${cpc} | ${c.conversions} conv | CPA R$ ${cpa} | ROAS ${roas}`;
    })
    .join('\n');

  const prompt = `Você é um media buyer sênior especializado em ${platformLabel}.
Analise as campanhas abaixo com foco no objetivo: ${objectiveLabel}.

PERÍODO: ${periodo || 'não informado'}
CONTEXTO DO NEGÓCIO: ${contexto || 'não informado'}

MÉTRICAS AGREGADAS:
- Gasto total: R$ ${benchmarks.totals.spend.toFixed(2)}
- Impressões: ${benchmarks.totals.impressions}
- Cliques: ${benchmarks.totals.clicks}
- CTR médio: ${benchmarks.ctr.toFixed(2)}%
- CPC médio: R$ ${benchmarks.cpc.toFixed(2)}
- Conversões: ${benchmarks.totals.conversions}
- CPA médio: ${benchmarks.cpa ? `R$ ${benchmarks.cpa.toFixed(2)}` : 'sem dados'}
- Taxa de conversão (clique→conv): ${benchmarks.cvr.toFixed(2)}%
- Frequência média: ${benchmarks.avgFrequency.toFixed(2)}
- Alertas automáticos: ${benchmarks.flags.length ? benchmarks.flags.join('; ') : 'nenhum'}

CAMPANHAS:
${campaignSummary}

Responda SOMENTE com JSON válido (sem markdown), neste formato:
{
  "score": 0-100,
  "resumo": "2-3 frases diretas sobre saúde geral da conta",
  "diagnostico": {
    "funciona": ["item específico com número"],
    "nao_funciona": ["item específico com número"],
    "incerto": ["o que falta medir ou amostra pequena"]
  },
  "recomendacoes": [
    {
      "prioridade": "alta|media|baixa",
      "acao": "ação concreta",
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
    "pausar": ["campanhas ou conjuntos a pausar"],
    "escalar": ["campanhas ou conjuntos a escalar"],
    "realocar": "sugestão de redistribuição em %"
  },
  "proximos_passos": ["3 ações para fazer hoje em ordem"]
}

Regras:
- Seja específico para o objetivo "${objetivo}", não genérico.
- Cite números das campanhas nas recomendações.
- Se faltar dado crítico (pixel, conversões, período), diga o que coletar.
- Máximo 5 recomendações, 3 testes A/B.
- Português brasileiro, tom de consultor direto.`;

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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'Erro na API Anthropic',
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
