const OBJETIVOS = {
  leads: 'gerar leads',
  vendas: 'gerar vendas com ROAS positivo',
  trafego: 'trazer tráfego qualificado',
  conversoes: 'gerar conversões no site',
  reconhecimento: 'aumentar alcance e reconhecimento',
};

const TIPOS = {
  search: 'Pesquisa',
  pmax: 'Performance Max',
  display: 'Display',
  youtube: 'YouTube',
  outros: 'Outro',
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseNum(value) {
  if (value === null || value === undefined || value === '') return 0;
  const raw = String(value).trim();
  const isPct = raw.includes('%');
  let s = raw.replace(/[R$\s%]/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  else if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function metrics(c) {
  const spend = parseNum(c.spend);
  const impressions = parseNum(c.impressions);
  const clicks = parseNum(c.clicks);
  const conversions = parseNum(c.conversions);
  const revenue = parseNum(c.revenue);
  const ctr = impressions ? (clicks / impressions) * 100 : 0;
  const cpc = clicks ? spend / clicks : 0;
  const cpa = conversions ? spend / conversions : 0;
  const cvr = clicks ? (conversions / clicks) * 100 : 0;
  const roas = spend && revenue ? revenue / spend : 0;
  return { spend, impressions, clicks, conversions, revenue, ctr, cpc, cpa, cvr, roas };
}

function verdict(campaign, m, objetivo) {
  const tipo = TIPOS[campaign.tipo] ? campaign.tipo : 'outros';
  const reasons = [];
  let status = 'aguardar';
  let label = 'Aguardar mais dados';

  if (m.clicks < 30 && m.impressions < 500) {
    reasons.push('Poucos cliques/impressões ainda — cedo para mudanças grandes.');
    return { status, label, reasons, melhorar: [], manter: [], nao_mexer: reasons };
  }

  const melhorar = [];
  const manter = [];
  const nao_mexer = [];

  const ctrMin = tipo === 'search' ? 2 : tipo === 'display' ? 0.35 : 1;
  if (m.ctr >= ctrMin * 1.5) {
    manter.push(`CTR de ${m.ctr.toFixed(2)}% está bom para ${TIPOS[tipo]}.`);
  } else if (m.impressions >= 300) {
    melhorar.push(`CTR de ${m.ctr.toFixed(2)}% abaixo do esperado — revisar anúncios e palavras-chave.`);
  }

  if (['leads', 'vendas', 'conversoes'].includes(objetivo)) {
    if (m.spend > 80 && m.conversions === 0) {
      melhorar.push('Gastou sem converter — checar tag de conversão antes de mudar criativo.');
      status = 'otimizar';
      label = 'Otimizar (tracking?)';
    } else if (m.cvr >= 2) {
      manter.push(`Taxa de conversão de ${m.cvr.toFixed(2)}% está saudável.`);
    } else if (m.clicks >= 50 && m.cvr < 1) {
      melhorar.push(`Conversão pós-clique baixa (${m.cvr.toFixed(2)}%) — revisar landing page.`);
    }

    if (objetivo === 'vendas' && m.roas > 0) {
      if (m.roas >= 2) {
        manter.push(`ROAS de ${m.roas.toFixed(2)}x — campanha lucrativa.`);
        status = 'escalar';
        label = 'Escalar';
      } else if (m.roas < 1 && m.spend > 100) {
        melhorar.push(`ROAS de ${m.roas.toFixed(2)}x — abaixo do breakeven.`);
        status = 'pausar';
        label = 'Pausar ou reestruturar';
      }
    }
  }

  const share = parseNum(campaign.impressionShare);
  if (tipo === 'search' && share > 0 && share < 40) {
    melhorar.push(`Parcela de impressões em ${share}% — orçamento ou lance pode estar limitando.`);
  }

  if (melhorar.length === 0 && manter.length > 0 && status === 'aguardar') {
    status = 'manter';
    label = 'Manter e monitorar';
  } else if (melhorar.length > 0 && status === 'aguardar') {
    status = 'otimizar';
    label = 'Otimizar';
  }

  if (m.clicks < 100) {
    nao_mexer.push('Menos de 100 cliques — evite mudanças drásticas (algoritmo ainda aprendendo).');
  }

  if (status === 'escalar') {
    reasons.push('Performance acima da média para o objetivo.');
  } else if (status === 'pausar') {
    reasons.push('Performance fraca ou prejuízo claro.');
  } else if (status === 'otimizar') {
    reasons.push('Tem potencial, mas há gargalos claros.');
  } else if (status === 'manter') {
    reasons.push('Métricas estáveis — não há urgência em mudar.');
  } else {
    reasons.push('Dados insuficientes para recomendação forte.');
  }

  return { status, label, reasons, melhorar, manter, nao_mexer };
}

function analyzeWithRules(campaigns, objetivo) {
  const analyzed = campaigns.map((c) => {
    const m = metrics(c);
    const v = verdict(c, m, objetivo);
    return {
      nome: c.nome,
      tipo: TIPOS[c.tipo] || TIPOS.outros,
      ...m,
      verdict: v.status,
      verdictLabel: v.label,
      melhorar: v.melhorar,
      manter: v.manter,
      nao_mexer: v.nao_mexer,
      motivo: v.reasons.join(' '),
    };
  });

  const totals = analyzed.reduce(
    (acc, c) => {
      acc.spend += c.spend;
      acc.clicks += c.clicks;
      acc.conversions += c.conversions;
      acc.revenue += c.revenue;
      return acc;
    },
    { spend: 0, clicks: 0, conversions: 0, revenue: 0 }
  );

  const melhorar = [];
  const manter = [];
  const nao_mexer = [];
  const escalar = [];
  const pausar = [];

  analyzed.forEach((c) => {
    c.melhorar.forEach((x) => melhorar.push(`${c.nome}: ${x}`));
    c.manter.forEach((x) => manter.push(`${c.nome}: ${x}`));
    c.nao_mexer.forEach((x) => nao_mexer.push(`${c.nome}: ${x}`));
    if (c.verdict === 'escalar') escalar.push(c.nome);
    if (c.verdict === 'pausar') pausar.push(c.nome);
  });

  const score = Math.min(
    100,
    Math.max(
      20,
      50 +
        (totals.conversions > 0 ? 15 : -10) +
        (totals.clicks > 100 ? 10 : 0) +
        escalar.length * 10 -
        pausar.length * 15
    )
  );

  const passos = [];
  if (pausar.length) passos.push(`Revisar ou pausar: ${pausar.join(', ')}`);
  if (escalar.length) passos.push(`Testar aumento de 15–20% no orçamento de: ${escalar.join(', ')}`);
  if (melhorar.length) passos.push('Corrigir o item mais crítico da lista "Melhorar" antes de criar campanhas novas');
  if (passos.length < 3) passos.push('Exportar relatório daqui 7 dias com os mesmos filtros e comparar');

  return {
    score,
    resumo: pausar.length
      ? `Atenção: ${pausar.length} campanha(s) com sinal de prejuízo ou falha. Priorize correção antes de escalar.`
      : escalar.length
        ? `${escalar.length} campanha(s) prontas para escalar com cautela.`
        : 'Conta em fase de ajuste — foque em otimizar antes de aumentar verba.',
    campanhas: analyzed,
    melhorar: [...new Set(melhorar)].slice(0, 8),
    manter: [...new Set(manter)].slice(0, 8),
    nao_mexer: [...new Set(nao_mexer)].slice(0, 6),
    escalar,
    pausar,
    proximos_passos: passos.slice(0, 3),
    totais: totals,
  };
}

async function enhanceWithAI(rules, context) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const campanhas = rules.campanhas
    .map(
      (c) =>
        `${c.nome} (${c.tipo}): R$${c.spend.toFixed(0)} gasto, ${c.clicks} cliques, CTR ${c.ctr.toFixed(2)}%, ${c.conversions} conv, veredito: ${c.verdictLabel}`
    )
    .join('\n');

  const prompt = `Você é consultor Google Ads. Com base na análise automática abaixo, dê orientação prática em PT-BR.

Objetivo: ${OBJETIVOS[context.objetivo] || context.objetivo}
Período: ${context.periodo || 'não informado'}
Nicho: ${context.nicho || 'não informado'}
Contexto: ${context.contexto || 'não informado'}

Análise automática:
Score: ${rules.score}
Resumo: ${rules.resumo}
Melhorar: ${rules.melhorar.join('; ') || 'nenhum'}
Manter: ${rules.manter.join('; ') || 'nenhum'}
Não mexer: ${rules.nao_mexer.join('; ') || 'nenhum'}

Campanhas:
${campanhas}

Responda SOMENTE JSON válido:
{
  "resumo_consultor": "2 frases diretas",
  "melhorar": ["máx 4 ações prioritárias"],
  "manter": ["o que está bom e não deve mudar"],
  "nao_mexer": ["o que evitar alterar agora e por quê"],
  "proximos_passos": ["3 passos concretos no painel Google Ads hoje"]
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Falha na IA');
  }

  const text = (data.content || []).map((b) => b.text || '').join('');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Resposta da IA inválida');
  return JSON.parse(match[0]);
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const { objetivo, campaigns, periodo, nicho, contexto, usar_ia } = req.body || {};

  if (!objetivo || !OBJETIVOS[objetivo]) {
    return res.status(400).json({ error: 'Escolha um objetivo válido' });
  }
  if (!Array.isArray(campaigns) || !campaigns.length) {
    return res.status(400).json({ error: 'Adicione pelo menos uma campanha' });
  }

  const normalized = campaigns.map((c, i) => ({
    nome: (c.nome || `Campanha ${i + 1}`).trim(),
    tipo: TIPOS[c.tipo] ? c.tipo : 'outros',
    spend: c.spend,
    impressions: c.impressions,
    clicks: c.clicks,
    conversions: c.conversions,
    revenue: c.revenue,
    impressionShare: c.impressionShare,
  }));

  const rules = analyzeWithRules(normalized, objetivo);
  let ia = null;
  let ia_erro = null;

  if (usar_ia !== false) {
    try {
      ia = await enhanceWithAI(rules, { objetivo, periodo, nicho, contexto });
    } catch (err) {
      ia_erro = err.message;
    }
  }

  const resultado = {
    ...rules,
    resumo: ia?.resumo_consultor || rules.resumo,
    melhorar: ia?.melhorar?.length ? ia.melhorar : rules.melhorar,
    manter: ia?.manter?.length ? ia.manter : rules.manter,
    nao_mexer: ia?.nao_mexer?.length ? ia.nao_mexer : rules.nao_mexer,
    proximos_passos: ia?.proximos_passos?.length ? ia.proximos_passos : rules.proximos_passos,
    fonte: ia ? 'regras+ia' : 'regras',
    ia_erro,
  };

  return res.status(200).json(resultado);
}
