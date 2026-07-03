// api/groq.js
// Vercel Serverless Function — actúa como proxy hacia Groq.
// La API key vive SOLO en el servidor (variables de entorno de Vercel),
// nunca en el navegador del usuario ni en el código subido a GitHub.

export default async function handler(req, res) {
  // Permite que tu sitio en GitHub Pages llame a este backend en Vercel
  res.setHeader('Access-Control-Allow-Origin', 'https://saulcreen.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: { message: 'Método no permitido' } });
  }

  const { model, messages, temperature } = req.body || {};

  if (!model || !messages) {
    return res.status(400).json({ error: { message: 'Faltan "model" o "messages" en el body' } });
  }

  // Soporta hasta 2 keys por si la primera falla o se queda sin cuota (mismo patrón de fallback que PeynTur)
  const keys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(Boolean);

  if (keys.length === 0) {
    return res.status(500).json({
      error: { message: 'No hay GROQ_API_KEY configurada en las variables de entorno de Vercel.' }
    });
  }

  let lastError = { error: { message: 'Error desconocido' } };

  for (const key of keys) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({ model, messages, temperature })
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        return res.status(200).json(data);
      }

      // Si fue error de auth/cuota, probamos la siguiente key; si fue otro error, lo devolvemos igual
      lastError = await groqRes.json().catch(() => ({ error: { message: `HTTP ${groqRes.status}` } }));
    } catch (err) {
      lastError = { error: { message: err.message } };
    }
  }

  return res.status(502).json(lastError);
}
