export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { overall, domainSummary } = req.body
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in environment' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: 'You are an AZ-900 exam coach. Be direct and concise. No filler.',
        messages: [{
          role: 'user',
          content: `Generate a session recap. Respond ONLY with valid JSON, no markdown.

Overall: ${overall.correct}/${overall.total} (${overall.pct}%)
${domainSummary}

JSON schema: {
  "verdict": "pass" | "borderline" | "needs_work",
  "weak_topics": string[],
  "next_session_focus": string[],
  "encouragement": string
}`,
        }],
      }),
    })

    const data = await response.json()
    const text = data.content?.find(b => b.type === 'text')?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    res.status(200).json(parsed)
  } catch (e) {
    res.status(500).json({ error: 'Recap generation failed', detail: e.message })
  }
}
