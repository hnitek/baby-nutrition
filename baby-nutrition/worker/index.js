const ALLOWED_ORIGIN = 'https://hnitek.github.io'

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const hdrs = corsHeaders(origin)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: hdrs })
    }

    if (origin !== ALLOWED_ORIGIN) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: hdrs })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...hdrs, 'Content-Type': 'application/json' },
      })
    }

    const { message, max_tokens = 1024 } = body

    if (!message) {
      return new Response(JSON.stringify({ error: 'Missing message' }), {
        status: 400,
        headers: { ...hdrs, 'Content-Type': 'application/json' },
      })
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens,
        messages: [{ role: 'user', content: message }],
      }),
    })

    if (!anthropicResponse.ok) {
      const err = await anthropicResponse.text()
      return new Response(JSON.stringify({ error: err }), {
        status: anthropicResponse.status,
        headers: { ...hdrs, 'Content-Type': 'application/json' },
      })
    }

    const result = await anthropicResponse.json()
    const text = result.content?.[0]?.text ?? ''

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...hdrs, 'Content-Type': 'application/json' },
    })
  },
}
