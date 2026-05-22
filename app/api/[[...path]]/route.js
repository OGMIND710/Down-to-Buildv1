import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const FALLBACK_SYSTEM_PROMPT = `You are DTB ("Down To Build"). Output ONLY a single \`\`\`jsx block defining function App() { ... } using globals React/useState/useEffect, Tailwind classes only, no imports.`

async function handleLLMChat(body) {
  const { provider, model, baseUrl, apiKey, messages, systemPrompt } = body
  const sys = systemPrompt || FALLBACK_SYSTEM_PROMPT
  const fullMessages = [{ role: 'system', content: sys }, ...messages]

  if (provider === 'ollama') {
    const url = (baseUrl || 'http://localhost:11434').replace(/\/$/, '') + '/api/chat'
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || 'llama3.2', messages: fullMessages, stream: false }),
    })
    if (!res.ok) return NextResponse.json({ error: `Ollama: ${res.status} ${await res.text()}` }, { status: 500 })
    const data = await res.json()
    return NextResponse.json({ content: data.message?.content || '' })
  }

  let url = ''; const headers = { 'Content-Type': 'application/json' }; let payload = {}
  if (provider === 'openai') {
    url = 'https://api.openai.com/v1/chat/completions'; headers['Authorization'] = `Bearer ${apiKey}`
    payload = { model: model || 'gpt-4o-mini', messages: fullMessages }
  } else if (provider === 'groq') {
    url = 'https://api.groq.com/openai/v1/chat/completions'; headers['Authorization'] = `Bearer ${apiKey}`
    payload = { model: model || 'llama-3.3-70b-versatile', messages: fullMessages }
  } else if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages'
    headers['x-api-key'] = apiKey; headers['anthropic-version'] = '2023-06-01'
    const rest = fullMessages.filter(m => m.role !== 'system')
    payload = { model: model || 'claude-3-5-sonnet-20241022', system: sys, messages: rest, max_tokens: 4096 }
  } else if (provider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions'; headers['Authorization'] = `Bearer ${apiKey}`
    payload = { model: model || 'meta-llama/llama-3.3-70b-instruct:free', messages: fullMessages }
  } else {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
  if (!res.ok) return NextResponse.json({ error: `${provider}: ${res.status} ${await res.text()}` }, { status: 500 })
  const data = await res.json()
  const content = provider === 'anthropic' ? (data.content?.[0]?.text || '') : (data.choices?.[0]?.message?.content || '')
  return NextResponse.json({ content })
}

// ===== STREAMING =====
async function handleLLMStream(body) {
  const { provider, model, baseUrl, apiKey, messages, systemPrompt } = body
  const sys = systemPrompt || FALLBACK_SYSTEM_PROMPT
  const fullMessages = [{ role: 'system', content: sys }, ...messages]

  let upstreamRes
  let kind = 'openai' // ndjson for ollama; sse for openai/groq/openrouter; sse-anthropic

  if (provider === 'ollama') {
    const url = (baseUrl || 'http://localhost:11434').replace(/\/$/, '') + '/api/chat'
    upstreamRes = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || 'llama3.2', messages: fullMessages, stream: true }),
    })
    kind = 'ollama'
  } else if (provider === 'openai' || provider === 'groq' || provider === 'openrouter') {
    const map = {
      openai: ['https://api.openai.com/v1/chat/completions', 'gpt-4o-mini'],
      groq: ['https://api.groq.com/openai/v1/chat/completions', 'llama-3.3-70b-versatile'],
      openrouter: ['https://openrouter.ai/api/v1/chat/completions', 'meta-llama/llama-3.3-70b-instruct:free'],
    }
    const [u, defaultModel] = map[provider]
    upstreamRes = await fetch(u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model || defaultModel, messages: fullMessages, stream: true }),
    })
    kind = 'openai'
  } else if (provider === 'anthropic') {
    const rest = fullMessages.filter(m => m.role !== 'system')
    upstreamRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model || 'claude-3-5-sonnet-20241022', system: sys, messages: rest, max_tokens: 4096, stream: true }),
    })
    kind = 'anthropic'
  } else {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    const t = await upstreamRes.text().catch(() => '')
    return new Response(`__DTB_ERROR__${upstreamRes.status} ${t}`, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  const reader = upstreamRes.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const raw of lines) {
            const line = raw.trim()
            if (!line) continue
            try {
              if (kind === 'ollama') {
                const j = JSON.parse(line)
                const chunk = j.message?.content || ''
                if (chunk) controller.enqueue(encoder.encode(chunk))
              } else if (kind === 'openai') {
                if (!line.startsWith('data:')) continue
                const payload = line.slice(5).trim()
                if (payload === '[DONE]') continue
                const j = JSON.parse(payload)
                const chunk = j.choices?.[0]?.delta?.content || ''
                if (chunk) controller.enqueue(encoder.encode(chunk))
              } else if (kind === 'anthropic') {
                if (!line.startsWith('data:')) continue
                const payload = line.slice(5).trim()
                const j = JSON.parse(payload)
                if (j.type === 'content_block_delta') {
                  const chunk = j.delta?.text || ''
                  if (chunk) controller.enqueue(encoder.encode(chunk))
                }
              }
            } catch (e) { /* skip malformed */ }
          }
        }
        controller.close()
      } catch (e) {
        controller.error(e)
      }
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' },
  })
}

async function handleSupabase(body) {
  const { action, url, key, projects } = body
  if (!url || !key) return NextResponse.json({ error: 'Supabase URL/key missing' }, { status: 400 })
  const base = url.replace(/\/$/, '') + '/rest/v1/dtb_projects'
  const h = { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
  if (action === 'test') {
    const res = await fetch(`${base}?select=id&limit=1`, { headers: h })
    if (!res.ok) return NextResponse.json({ error: `Test: ${res.status} ${await res.text()}` }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'push') {
    const rows = (projects || []).map(p => ({ id: p.id, data: p, updated_at: new Date().toISOString() }))
    const res = await fetch(base, { method: 'POST', headers: { ...h, 'Prefer': 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) })
    if (!res.ok) return NextResponse.json({ error: `Push: ${res.status} ${await res.text()}` }, { status: 500 })
    return NextResponse.json({ ok: true, count: rows.length })
  }
  if (action === 'pull') {
    const res = await fetch(`${base}?select=*&order=updated_at.desc`, { headers: h })
    if (!res.ok) return NextResponse.json({ error: `Pull: ${res.status} ${await res.text()}` }, { status: 500 })
    const rows = await res.json()
    return NextResponse.json({ projects: rows.map(r => r.data) })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

async function handleGitHubUser(body) {
  const { token } = body
  const res = await fetch('https://api.github.com/user', {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
  })
  if (!res.ok) return NextResponse.json({ error: `GitHub: ${res.status}` }, { status: 500 })
  const u = await res.json()
  return NextResponse.json({ login: u.login, name: u.name, avatar: u.avatar_url })
}

async function handleGitHubPush(body) {
  const { token, repo, branch, path, content, message } = body
  if (!token || !repo || !path) return NextResponse.json({ error: 'token/repo/path required' }, { status: 400 })
  const apiBase = `https://api.github.com/repos/${repo}/contents/${path}`
  const h = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' }
  let sha
  const cur = await fetch(`${apiBase}?ref=${encodeURIComponent(branch || 'main')}`, { headers: h })
  if (cur.ok) { const j = await cur.json(); sha = j.sha }
  const b64 = Buffer.from(content || '', 'utf-8').toString('base64')
  const res = await fetch(apiBase, {
    method: 'PUT', headers: h,
    body: JSON.stringify({ message: message || 'Update via DTB', content: b64, branch: branch || 'main', sha }),
  })
  if (!res.ok) return NextResponse.json({ error: `GitHub push: ${res.status} ${await res.text()}` }, { status: 500 })
  const data = await res.json()
  return NextResponse.json({ ok: true, url: data.content?.html_url })
}

async function handleOllamaModels(body) {
  const { baseUrl } = body
  const url = (baseUrl || 'http://localhost:11434').replace(/\/$/, '') + '/api/tags'
  try {
    const res = await fetch(url)
    if (!res.ok) return NextResponse.json({ error: `Ollama: ${res.status}` }, { status: 500 })
    const j = await res.json()
    return NextResponse.json({ models: (j.models || []).map(m => m.name) })
  } catch (e) {
    return NextResponse.json({ error: `Cannot reach Ollama at ${url}: ${e.message}` }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  const path = params.path?.join('/') || ''
  try {
    const body = await request.json()
    if (path === 'llm/chat') return await handleLLMChat(body)
    if (path === 'llm/stream') return await handleLLMStream(body)
    if (path === 'sync/supabase') return await handleSupabase(body)
    if (path === 'sync/github') return await handleGitHubPush(body)
    if (path === 'sync/github/user') return await handleGitHubUser(body)
    if (path === 'ollama/models') return await handleOllamaModels(body)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request, { params }) {
  const path = params.path?.join('/') || ''
  if (path === 'health') return NextResponse.json({ ok: true, app: 'DTB' })
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
