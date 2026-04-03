export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { assunto, publico, objetivo, tom, formato, nslides } = req.body;
  if (!assunto) return res.status(400).json({ error: 'Assunto obrigatório' });

  const prompt = 'Você é copywriter sênior da Studio Escuta. Crie ' + (nslides||7) + ' slides para ' + (formato||'Instagram') + '. Assunto: ' + assunto + '. Público: ' + (publico||'profissionais de marketing') + '. Objetivo: ' + (objetivo||'Educar') + '. Tom: ' + (tom||'educativo e direto') + '. Responda SOMENTE com JSON: {"slides":[{"tipo":"cover","tag":"palavra","titulo":"texto","corpo":"texto"},{"tipo":"content","tag":"palavra","titulo":"texto","corpo":"texto"},{"tipo":"cta","tag":"Studio Escuta","titulo":"texto","corpo":"texto"}]}';

  try {
    const response = await fetcapi/gerar.jsh('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Erro na API' });
    const rawText = (data.content || []).map(b => b.text || '').join('');
    const jsonMatch = rawText.match(/{[sS]*}/);
    if (!jsonMatch) throw new Error('JSON não encontrado');
    return res.status(200).json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
