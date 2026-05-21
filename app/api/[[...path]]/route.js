import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are DTB ("Down To Build") — an expert React component builder operating under a Cline-inspired agent workflow. Your job is to generate a SINGLE, self-contained React functional component based on the user's request, and to FIX it when given error feedback.

STRICT RULES:
1. Output ONLY JSX/JS code inside a single \`\`\`jsx code block. No prose before/after.
2. The component MUST be named "App" using "function App() { ... }" (no export, no arrow at root).
3. Hooks via React global: const { useState, useEffect, useRef, useMemo } = React;
4. Tailwind CSS classes only. Make it BEAUTIFUL: modern spacing, subtle borders, hover states, smooth transitions.
5. DO NOT import anything. React, ReactDOM, hooks are global.
6. DO NOT use TypeScript.
7. Prefer a neutral / grey aesthetic with one accent color unless the user requests otherwise.
8. If the user provides an ERROR message, return the FULL CORRECTED component (not a diff).

Example:
\`\`\`jsx
function App() {
  const { useState } = React;
  const [count, setCount] = useState(0);
  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
      <button onClick={() => setCount(count + 1)} className="px-5 py-2.5 bg-neutral-100 text-neutral-900 rounded-lg font-medium hover:bg-white transition">
        Clicked {count} times
      </button>
    </div>
  );
}
\`\`\``

async function handleLLMChat(body) {
  const { provider, model, baseUrl, apiKey, messages } = body
  const fullMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages]

  if (provider === 'ollama') {
    const url = (baseUrl || 'http://localhost:11434').replace(/\/$/, '') + '/api/chat'
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || 'llama3.2', messages: fullMessages, stream: false }),
    })
    if (!res.ok) return NextResponse.json({ error: `Ollama error: ${res.status} ${await res.text()}` }, { status: 500 })
    const data = await res.json()
    return NextResponse.json({ content: data.message?.content || '' })
  }

  let url = ''; const headers = { 'Content-Type': 'application/json' }; let payload = {}

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
    payload = { model: model || 'claude-3-5-sonnet-20241022', system: sys, messages: rest, max_tokens: 4096 }
  } else if (provider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/chat/completions'
    headers['Authorization'] = `Bearer ${apiKey}`
    payload = { model: model || 'meta-llama/llama-3.3-70b-instruct:free', messages: fullMessages }
  } else {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
  if (!res.ok) return NextResponse.json({ error: `${provider} error: ${res.status} ${await res.text()}` }, { status: 500 })
  const data = await res.json()
  const content = provider === 'anthropic' ? (data.content?.[0]?.text || '') : (data.choices?.[0]?.message?.content || '')
  return NextResponse.json({ content })
}

async function handleSupabase(body) {
  const { action, url, key, projects } = body
  if (!url || !key) return NextResponse.json({ error: 'Supabase URL/key missing' }, { status: 400 })
  const base = url.replace(/\/$/, '') + '/rest/v1/dtb_projects'
  const h = { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }

  if (action === 'push') {
    // upsert each
    const rows = (projects || []).map(p => ({ id: p.id, data: p, updated_at: new Date().toISOString() }))
    const res = await fetch(base, {
      method: 'POST',
      headers: { ...h, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    })
    if (!res.ok) return NextResponse.json({ error: `Supabase push: ${res.status} ${await res.text()}` }, { status: 500 })
    return NextResponse.json({ ok: true, count: rows.length })
  }
  if (action === 'pull') {
    const res = await fetch(`${base}?select=*&order=updated_at.desc`, { headers: h })
    if (!res.ok) return NextResponse.json({ error: `Supabase pull: ${res.status} ${await res.text()}` }, { status: 500 })
    const rows = await res.json()
    return NextResponse.json({ projects: rows.map(r => r.data) })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

async function handleGitHub(body) {
  const { token, repo, branch, path, content, message } = body
  if (!token || !repo || !path) return NextResponse.json({ error: 'token/repo/path required' }, { status: 400 })
  const apiBase = `https://api.github.com/repos/${repo}/contents/${path}`
  const h = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' }

  // Get current sha (if file exists)
  let sha = undefined
  const cur = await fetch(`${apiBase}?ref=${encodeURIComponent(branch || 'main')}`, { headers: h })
  if (cur.ok) { const j = await cur.json(); sha = j.sha }

  const b64 = Buffer.from(content || '', 'utf-8').toString('base64')
  const res = await fetch(apiBase, {
    method: 'PUT', headers: h,
    body: JSON.stringify({ message: message || 'Update via DTB', content: b64, branch: branch || 'main', sha }),
  })
  if (!res.ok) return NextResponse.json({ error: `GitHub: ${res.status} ${await res.text()}` }, { status: 500 })
  const data = await res.json()
  return NextResponse.json({ ok: true, url: data.content?.html_url })
}

export async function POST(request, { params }) {
  const path = params.path?.join('/') || ''
  try {
    const body = await request.json()
    if (path === 'llm/chat') return await handleLLMChat(body)
    if (path === 'sync/supabase') return await handleSupabase(body)
    if (path === 'sync/github') return await handleGitHub(body)
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
