import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are an expert React component builder. Your only job is to generate a SINGLE, self-contained React functional component based on the user's request.

STRICT RULES:
1. Output ONLY JSX/JS code inside a single \`\`\`jsx code block. No explanations before or after.
2. The component MUST be named "App" and use "function App() { ... }" syntax (NOT export default, NOT arrow function at root).
3. Use React hooks via the React global: const { useState, useEffect } = React;
4. Use Tailwind CSS classes for styling. Make it BEAUTIFUL with modern design - gradients, shadows, spacing, hover effects.
5. DO NOT use imports. Everything (React, hooks) is globally available.
6. DO NOT use TypeScript.
7. The component must be FULLY working and rendered standalone.
8. Prefer dark theme aesthetics with vibrant accents.
9. If user asks to modify the previous component, return the FULL updated component code.

Example output format:
\`\`\`jsx
function App() {
  const { useState } = React;
  const [count, setCount] = useState(0);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-purple-900 flex items-center justify-center p-8">
      <button onClick={() => setCount(count + 1)} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg shadow-lg transition">
        Count: {count}
      </button>
    </div>
  );
}
\`\`\``

export async function POST(request, { params }) {
  const path = params.path?.join('/') || ''
  try {
    if (path === 'llm/chat') {
      const body = await request.json()
      const { provider, model, baseUrl, apiKey, messages } = body

      const fullMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ]

      if (provider === 'ollama') {
        const url = (baseUrl || 'http://localhost:11434').replace(/\/$/, '') + '/api/chat'
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model || 'llama3.2',
            messages: fullMessages,
            stream: false,
          }),
        })
        if (!res.ok) {
          const txt = await res.text()
          return NextResponse.json({ error: `Ollama error: ${res.status} ${txt}` }, { status: 500 })
        }
        const data = await res.json()
        return NextResponse.json({ content: data.message?.content || '' })
      }

      // External APIs (OpenAI-compatible)
      let url = ''
      const headers = { 'Content-Type': 'application/json' }
      let payload = {}

      if (provider === 'openai') {
        url = 'https://api.openai.com/v1/chat/completions'
        headers['Authorization'] = `Bearer ${apiKey}`
        payload = { model: model || 'gpt-4o-mini', messages: fullMessages }
      } else if (provider === 'groq') {
        url = 'https://api.groq.com/openai/v1/chat/completions'
        headers['Authorization'] = `Bearer ${apiKey}`
        payload = { model: model || 'llama-3.3-70b-versatile', messages: fullMessages }
      } else if (provider === 'anthropic') {
        url = 'https://api.anthropic.com/v1/messages'
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
        const sys = fullMessages.find(m => m.role === 'system')?.content
        const rest = fullMessages.filter(m => m.role !== 'system')
        payload = {
          model: model || 'claude-3-5-sonnet-20241022',
          system: sys,
          messages: rest,
          max_tokens: 4096,
        }
      } else if (provider === 'openrouter') {
        url = 'https://openrouter.ai/api/v1/chat/completions'
        headers['Authorization'] = `Bearer ${apiKey}`
        payload = { model: model || 'meta-llama/llama-3.3-70b-instruct:free', messages: fullMessages }
      } else {
        return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const txt = await res.text()
        return NextResponse.json({ error: `${provider} error: ${res.status} ${txt}` }, { status: 500 })
      }
      const data = await res.json()
      const content = provider === 'anthropic'
        ? (data.content?.[0]?.text || '')
        : (data.choices?.[0]?.message?.content || '')
      return NextResponse.json({ content })
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request, { params }) {
  const path = params.path?.join('/') || ''
  if (path === 'health') return NextResponse.json({ ok: true })
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
