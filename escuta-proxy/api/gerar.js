export default async function handler(req, res) {
  // CORS — permite chamadas do widget e do seu frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { assunto, publico, objetivo, tom, formato, nslides } = req.body;

  if (!assunto) return res.status(400).json({ error: 'Assunto obrigatório' });

  const prompt = `Você é copywriter sênior da Studio Escuta, agência de conteúdo audiovisual. Crie um carrossel de ${nslides || 7} slides para ${formato || 'Instagram'}.

Assunto: ${assunto}
Público: ${publico || 'profissionais de marketing'}
Objetivo: ${objetivo || 'Educar'}
Tom: ${tom || 'educativo e direto'}

Estrutura obrigatória:
- Slide 1 (tipo "cover"): headline que para o scroll, máx 8 palavras. Subtítulo curto.
- Slides intermediários (tipo "content"): um insight por slide. Título máx 7 palavras. Corpo máx 22 palavras.
- Último slide (tipo "cta"): CTA direto da Studio Escuta.

Responda SOMENTE com JSON puro, sem markdown:
{"slides":[{"tipo":"cover","tag":"palavra","titulo":"texto","corpo":"texto"}]}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Erro na API' });
    }

    const rawText = (data.content || []).map(b => b.text || '').join('');
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON não encontrado na resposta');

    const slides = JSON.parse(jsonMatch[0]);
    return res.status(200).json(slides);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
