'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { toast } from 'sonner'
import {
  Plus, Save, FolderOpen, Send, Trash2, Settings as SettingsIcon,
  Code2, Eye, Bot, User, Loader2, ChevronLeft, ChevronRight, Download,
  Github, GitBranch, Hammer, Cloud, CloudOff, Zap, Square, SlidersHorizontal
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STORAGE_KEY, ACTIVE_KEY, DEFAULT_CODE, newProject, loadSettings, OVERRIDABLE_FIELDS, effectiveSettings, OUTPUT_MODES, getSystemPrompt, extractComponent, extractFiles, extractSupabase, extractQuestion, extractSearch } from '@/lib/dtb-store'
import JSZip from 'jszip'
import dynamic from 'next/dynamic'

// WebContainer runner is a client-only component that lazy-loads @webcontainer/api.
// We import it dynamically with ssr:false so the WebContainer SDK is never bundled
// for server rendering (it requires window/SharedArrayBuffer).
const WebContainerRunner = dynamic(() => import('@/components/WebContainerRunner'), { ssr: false })

const WC_PORT = 3050

function extractCode(text) { return extractComponent(text) }

function buildIframeSrc(code) {
  const safeCode = (code || '').replace(/<\/script>/g, '<\\/script>')
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<!-- crossorigin="anonymous" exposes real error messages instead of "Script error." for cross-origin CDN scripts -->
<script crossorigin="anonymous" src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script crossorigin="anonymous" src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script crossorigin="anonymous" src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<style>html,body,#root{margin:0;padding:0;min-height:100vh;background:#fafafa;color:#0a0a0a;font-family:system-ui,sans-serif}</style>
<script>
  // Capture every error type with the maximum amount of detail.
  function reportError(msg, source, line, col, stack) {
    var detail = [msg];
    if (source) detail.push('at ' + source + ':' + (line||'?') + ':' + (col||'?'));
    if (stack) detail.push(stack);
    parent.postMessage({ __dtb_error: true, message: detail.filter(Boolean).join('\\n') }, '*');
  }
  window.addEventListener('error', function (e) {
    reportError(e.message || 'unknown error', e.filename, e.lineno, e.colno, e.error && e.error.stack);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    reportError('Unhandled promise rejection: ' + (r && (r.message || r.toString())), '', '', '', r && r.stack);
  });
  // Override console.error so React-internal warnings/errors reach the agent too.
  var _origErr = console.error;
  console.error = function () {
    try {
      var args = Array.prototype.slice.call(arguments);
      var first = args[0];
      var s = (first && first.message) || (typeof first === 'string' ? first : JSON.stringify(first));
      // Only forward React error messages, not random warnings.
      if (s && /(Error:|Cannot read|undefined|not a function|Invalid|Uncaught)/i.test(s)) {
        parent.postMessage({ __dtb_error: true, message: 'console.error: ' + s }, '*');
      }
    } catch (e) {}
    return _origErr.apply(console, arguments);
  };
</script>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react">
// React ErrorBoundary catches render-time errors in App so the agent can see them.
class DtbErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error: error }; }
  componentDidCatch(error, info) {
    parent.postMessage({
      __dtb_error: true,
      message: (error && error.message ? error.message : String(error)) +
               (info && info.componentStack ? '\\nComponent stack:' + info.componentStack : '')
    }, '*');
  }
  render() {
    if (this.state.error) {
      return React.createElement('div', {
        style: { padding: '24px', color: '#dc2626', fontFamily: 'monospace', whiteSpace: 'pre-wrap', background: '#fef2f2' }
      }, '\u26A0\uFE0F Render error:\\n' + (this.state.error.message || String(this.state.error)));
    }
    return this.props.children;
  }
}
try {
${safeCode}
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(DtbErrorBoundary, null, React.createElement(App, null)));
  // We only mark __dtb_ok if no error fires within the next tick.
  setTimeout(function(){ parent.postMessage({ __dtb_ok: true }, '*'); }, 100);
} catch (e) {
  document.getElementById('root').innerHTML = '<div style="padding:24px;color:#dc2626;font-family:monospace;white-space:pre-wrap;background:#fef2f2">\u26A0\uFE0F Boot error:\\n' + (e.message || e) + (e.stack ? '\\n' + e.stack : '') + '</div>';
  parent.postMessage({ __dtb_error: true, message: 'Boot: ' + (e.message || String(e)) + (e.stack ? '\\n' + e.stack : '') }, '*');
}
</script>
</body>
</html>`
}

export default function App() {
  const [projects, setProjects] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [settings, setSettings] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [agentSteps, setAgentSteps] = useState([])
  const [tab, setTab] = useState('preview')
  const [overridesOpen, setOverridesOpen] = useState(false)
  const chatEndRef = useRef(null)
  const lastErrorRef = useRef(null)
  const abortRef = useRef(null)

  // Multi-file auto-fix loop state
  const [wcRunKey, setWcRunKey] = useState(0)
  const [pendingQuestion, setPendingQuestion] = useState(null) // { text, resolve }
  const [pendingPause, setPendingPause] = useState(null)       // { iter, lastError, resolve }
  const wcReadyRef = useRef(false)
  const wcErrorRef = useRef('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const list = raw ? JSON.parse(raw) : []
      const aId = localStorage.getItem(ACTIVE_KEY)
      if (list.length === 0) {
        const p = newProject(); setProjects([p]); setActiveId(p.id)
      } else {
        setProjects(list); setActiveId(aId && list.find(x => x.id === aId) ? aId : list[0].id)
      }
      setSettings(loadSettings())
    } catch (e) {
      const p = newProject(); setProjects([p]); setActiveId(p.id); setSettings(loadSettings())
    }
    // Refresh settings on focus (after returning from /settings)
    const onFocus = () => setSettings(loadSettings())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => { if (projects.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)) }, [projects])
  useEffect(() => { if (activeId) localStorage.setItem(ACTIVE_KEY, activeId) }, [activeId])

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.__dtb_error) lastErrorRef.current = e.data.message
      if (e.data?.__dtb_ok) lastErrorRef.current = null
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const active = projects.find(p => p.id === activeId) || projects[0]
  const updateActive = (patch) => setProjects(prev => prev.map(p => p.id === activeId ? { ...p, ...patch, updatedAt: Date.now() } : p))
  // Merged global + per-project overrides; this is what every flow uses.
  const eff = useMemo(() => settings ? effectiveSettings(settings, active) : null, [settings, active])
  const setOverride = (key, val) => updateActive({ overrides: { ...(active.overrides || {}), [key]: val } })
  const clearOverride = (key) => {
    const o = { ...(active.overrides || {}) }; delete o[key]
    updateActive({ overrides: o })
  }

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [active?.messages?.length, loading, streamingText, agentSteps.length])

  const handleNewProject = () => { const p = newProject(); setProjects(prev => [p, ...prev]); setActiveId(p.id); toast.success('New project') }
  const handleSave = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); toast.success('Saved') }
  const handleDelete = (id) => {
    if (!confirm('Delete this project?')) return
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id)
      if (next.length === 0) { const p = newProject(); setActiveId(p.id); return [p] }
      if (id === activeId) setActiveId(next[0].id)
      return next
    })
  }
  const handleRename = (id, name) => setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p))

  // Build payload (uses effective = global + per-project override)
  const buildPayload = (msgs) => ({
    provider: eff.mode === 'ollama' ? 'ollama' : eff.provider,
    model: eff.mode === 'ollama' ? eff.ollamaModel : eff.apiModel,
    baseUrl: eff.ollamaUrl,
    apiKey: eff.apiKey,
    systemPrompt: getSystemPrompt(eff.outputMode, eff.systemPrompt),
    messages: msgs.map(m => ({ role: m.role, content: m.content })),
  })

  // Streamed call
  const streamLLM = async (msgs, onChunk) => {
    const controller = abortRef.current || new AbortController()
    abortRef.current = controller
    const res = await fetch('/api/llm/stream', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(msgs)), signal: controller.signal,
    })
    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => 'stream failed')
      throw new Error(txt)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      if (chunk.startsWith('__DTB_ERROR__')) throw new Error(chunk.slice(13))
      full += chunk
      onChunk(full)
    }
    return full
  }

  const nonStreamLLM = async (msgs) => {
    const controller = abortRef.current || new AbortController()
    abortRef.current = controller
    const res = await fetch('/api/llm/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(msgs)),
      signal: controller.signal,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data.content || ''
  }

  const callLLM = async (msgs, onChunk) => {
    if (eff.streaming) return await streamLLM(msgs, onChunk)
    const c = await nonStreamLLM(msgs)
    onChunk(c)
    return c
  }

  const handleStop = () => { abortRef.current?.abort(); setLoading(false); toast.info('Stopped') }

  // === Agentic helpers (used by both Single Component and Fullstack loops) ===

  // POST /api/search → SearxNG → { results: [{title,url,snippet}] }
  const runSearch = async (query) => {
    try {
      const res = await fetch('/api/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, searxngUrl: settings.searxngUrl }),
      })
      const j = await res.json()
      if (!res.ok) return { error: j.error || 'Search failed', results: [] }
      return j
    } catch (e) { return { error: e.message, results: [] } }
  }

  const formatSearchResults = (sr) => {
    if (sr.error) return `Search failed: ${sr.error}\n\nPlease ignore the <DTB:SEARCH> result and continue with your best guess.`
    if (!sr.results || sr.results.length === 0) return `No results for "${sr.query}". Continue with best guess.`
    return sr.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n')
  }

  // Lifecycle events emitted by WebContainerRunner (mounted via ref-pattern below)
  const wcLifecycle = useCallback((evt) => {
    if (evt.type === 'ready') { wcReadyRef.current = true; /* keep prior error so we can detect compile failures that arrive shortly after */ }
    else if (['error-detected', 'dev-exited', 'install-failed', 'boot-failed'].includes(evt.type)) {
      // Capture errors whether the server is "ready" or not — Next.js can still emit
      // "Failed to compile" or "Module not found" AFTER the server bound to its port.
      wcErrorRef.current = (evt.message || evt.type) + '\n\n--- last 2KB of output ---\n' + (evt.buffer || '')
      // Force the loop to treat this as a failure instead of a ready
      wcReadyRef.current = false
    }
  }, [])

  // Wait for the WebContainer to either become ready or error out (or timeout).
  // After server-ready we wait an extra "grace" period (default 6s) to catch
  // Next.js compile errors that arrive AFTER the port is bound.
  const waitForWcOutcome = (maxMs = 120000, graceMs = 12000) => new Promise((resolve) => {
    const start = Date.now()
    let readySince = null
    const tick = () => {
      if (abortRef.current?.signal?.aborted) return resolve({ kind: 'abort' })
      // Error always wins — check it first
      if (wcErrorRef.current) return resolve({ kind: 'error', message: wcErrorRef.current })
      if (wcReadyRef.current) {
        if (readySince === null) readySince = Date.now()
        // Stay in the grace window: if no error arrives, we accept success.
        if (Date.now() - readySince > graceMs) return resolve({ kind: 'ready' })
      }
      if (Date.now() - start > maxMs) return resolve({ kind: 'timeout', message: `No "server-ready" event after ${Math.round(maxMs/1000)}s.` })
      setTimeout(tick, 400)
    }
    tick()
  })

  // Promise resolver for the QUESTION bubble
  const askUser = (text) => new Promise((resolve) => {
    setPendingQuestion({ text, resolve: (answer) => { setPendingQuestion(null); resolve(answer) } })
  })

  // Promise resolver for the PAUSE bubble (after softCap iterations)
  const askPauseChoice = (iter, lastError) => new Promise((resolve) => {
    setPendingPause({ iter, lastError, resolve: (choice) => { setPendingPause(null); resolve(choice) } })
  })

  const handleSend = async () => {
    if (!input.trim() || loading || !active || !settings) return
    const userMsg = { role: 'user', content: input.trim() }
    const baseMessages = [...(active.messages || []), userMsg]
    updateActive({ messages: baseMessages })
    setInput(''); setLoading(true); setAgentSteps([]); setStreamingText('')
    // Fresh abort controller for the whole send (covers loop iterations too).
    abortRef.current = new AbortController()

    const isMultiFile = eff.outputMode === 'webcontainer' || eff.outputMode === 'local'
    const isSupabase = eff.outputMode === 'supabase'

    try {
      // ============ MULTI-FILE MODES (webcontainer / local) ============
      // Full Cline-style iterative loop: handles QUESTION/SEARCH tags,
      // mounts files in the WebContainer, listens for errors, and re-prompts
      // the LLM with the captured stderr until "server-ready" or the user
      // stops it via the pause bubble.
      if (isMultiFile) {
        let convMessages = baseMessages.slice()
        const softCap = Math.max(1, parseInt(eff.softIterationCap) || 15)
        let iter = 0
        let success = false
        let lastContent = ''

        // For 'local' mode we don't actually boot a WebContainer; we just
        // generate files once (no auto-fix loop). Behaviour preserved.
        if (eff.outputMode === 'local') {
          const content = await callLLM(convMessages, (t) => setStreamingText(t))
          const files = extractFiles(content)
          const aiMsg = { role: 'assistant', content }
          if (files.length > 0) {
            updateActive({ messages: [...baseMessages, aiMsg], files })
            setTab('files'); toast.success(`Generated ${files.length} files`)
          } else {
            updateActive({ messages: [...baseMessages, aiMsg] })
            toast.warning('No file blocks detected')
          }
          return
        }

        // ---- webcontainer auto-fix loop ----
        while (true) {
          if (abortRef.current?.signal?.aborted) {
            setAgentSteps(s => [...s, { kind: 'warn', label: 'Stopped by user' }]); break
          }
          setAgentSteps(s => [...s, { kind: 'thinking', label: iter === 0 ? 'Generating files…' : `Iteration ${iter + 1}: re-generating with error feedback` }])
          setStreamingText('')
          const content = await callLLM(convMessages, (t) => setStreamingText(t))
          lastContent = content
          setStreamingText('')

          // 1) Did the agent ask a question?
          const question = extractQuestion(content)
          if (question) {
            setAgentSteps(s => [...s, { kind: 'thinking', label: '❓ Agent is asking a question' }])
            const answer = await askUser(question)
            if (!answer || abortRef.current?.signal?.aborted) {
              setAgentSteps(s => [...s, { kind: 'warn', label: 'Question cancelled' }]); break
            }
            convMessages = [...convMessages, { role: 'assistant', content }, { role: 'user', content: answer }]
            iter++; continue
          }

          // 2) Did the agent request a web search?
          const searchQuery = extractSearch(content)
          if (searchQuery) {
            setAgentSteps(s => [...s, { kind: 'thinking', label: `🔍 Searching: ${searchQuery}` }])
            const sr = await runSearch(searchQuery)
            const formatted = formatSearchResults({ query: searchQuery, ...sr })
            setAgentSteps(s => [...s, { kind: 'ok', label: `📚 ${sr.results?.length || 0} results retrieved` }])
            convMessages = [
              ...convMessages,
              { role: 'assistant', content },
              { role: 'user', content: `Search results for "${searchQuery}":\n\n${formatted}\n\nNow continue the original task using these results.` },
            ]
            iter++; continue
          }

          // 3) Extract files
          const files = extractFiles(content)
          if (files.length === 0) {
            setAgentSteps(s => [...s, { kind: 'warn', label: 'No ```file:path blocks in response — asking again' }])
            convMessages = [
              ...convMessages,
              { role: 'assistant', content },
              { role: 'user', content: 'Your response had NO ```file:path… ``` blocks. Re-emit the FULL multi-file project. For Next.js include AT LEAST package.json, app/layout.js, app/page.js.' },
            ]
            iter++; if (iter >= softCap) {
              const choice = await askPauseChoice(iter, 'No file blocks detected in 15 generations'); if (choice === 'stop') break
            }
            continue
          }

          // 4) Apply files and remount WebContainer
          wcReadyRef.current = false
          wcErrorRef.current = ''
          updateActive({ files, messages: [...baseMessages, { role: 'assistant', content }] })
          setTab('preview')
          setWcRunKey(k => k + 1)
          setAgentSteps(s => [...s, { kind: 'render', label: `📁 Mounted ${files.length} files — booting WebContainer (port ${WC_PORT})` }])

          // 5) Wait for outcome
          const outcome = await waitForWcOutcome(120000)
          if (outcome.kind === 'abort') { setAgentSteps(s => [...s, { kind: 'warn', label: 'Stopped by user' }]); break }
          if (outcome.kind === 'ready') {
            setAgentSteps(s => [...s, { kind: 'ok', label: `✓ App running on port ${WC_PORT}!` }])
            success = true; break
          }
          const errMsg = (outcome.message || 'unknown error').slice(0, 2500)
          setAgentSteps(s => [...s, { kind: 'err', label: `✗ ${errMsg.split('\n')[0].slice(0, 160)}` }])
          iter++

          // 6) Soft cap: ask the user how to proceed
          if (iter >= softCap) {
            const choice = await askPauseChoice(iter, errMsg)
            if (choice === 'stop') break
            if (choice === 'retry-fresh') {
              // restart conversation from the original user prompt
              convMessages = baseMessages.slice()
              iter = 0
              setAgentSteps(s => [...s, { kind: 'thinking', label: '↻ Restarting from scratch' }])
              continue
            }
            if (choice === 'search-first') {
              convMessages = [
                ...convMessages,
                { role: 'assistant', content },
                { role: 'user', content: `The WebContainer keeps failing after ${iter} attempts. Latest error:\n\n${errMsg}\n\nBefore retrying, emit a <DTB:SEARCH> query to look up the cause of this error on the web.` },
              ]
              continue
            }
            // 'continue' just resets the cap counter implicitly (we keep iter, but the cap check fires every softCap iterations)
          }

          // 7) Default: feed error back to LLM
          convMessages = [
            ...convMessages,
            { role: 'assistant', content },
            { role: 'user', content: `The WebContainer dev server FAILED to start. Latest output:\n\n${errMsg}\n\nReturn ALL files corrected (do NOT skip any). Requirements:\n- Port must be ${WC_PORT}\n- For Next.js you MUST include app/page.js AND app/layout.js\n- Use "npx --yes next dev -p ${WC_PORT}" in package.json scripts\n- Do not change tech stack unless the error requires it` },
          ]
        }

        if (!success && abortRef.current && !abortRef.current.signal.aborted) {
          updateActive({ messages: [...(active.messages || []), userMsg, { role: 'assistant', content: lastContent }] })
        }
        return
      }

      // Supabase mode: extract sql + jsx, no auto-iteration on errors (similar to component but with extra SQL state)
      if (isSupabase) {
        const content = await callLLM(baseMessages, (t) => setStreamingText(t))
        const { sql, jsx } = extractSupabase(content)
        const aiMsg = { role: 'assistant', content }
        const patch = { messages: [...baseMessages, aiMsg] }
        if (jsx) patch.code = jsx
        if (sql) patch.sql = sql
        updateActive(patch)
        if (jsx) setTab('preview')
        toast.success(`Generated ${jsx ? 'component' : ''}${jsx && sql ? ' + ' : ''}${sql ? 'SQL' : ''}`)
        return
      }

      // Component mode: existing flow
      if (!eff.agentMode) {
        const content = await callLLM(baseMessages, (t) => setStreamingText(t))
        const code = extractCode(content)
        const aiMsg = { role: 'assistant', content }
        if (code) { updateActive({ messages: [...baseMessages, aiMsg], code }); setTab('preview'); toast.success('Generated') }
        else { updateActive({ messages: [...baseMessages, aiMsg] }); toast.warning('No code block detected') }
      } else {
        let convMessages = baseMessages.slice()
        let finalCode = null
        let lastContent = ''
        const cap = Number(eff.maxIterations) || 3
        const unlimited = cap >= 99 || eff.unlimitedIterations === true
        const maxIter = unlimited ? 1000 : Math.max(1, Math.min(20, cap))

        let i = 0
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (!unlimited && i >= maxIter) {
            setAgentSteps(s => [...s, { kind: 'warn', label: `Max iterations reached (${maxIter})` }])
            break
          }
          if (abortRef.current?.signal?.aborted) {
            setAgentSteps(s => [...s, { kind: 'warn', label: 'Stopped by user' }])
            break
          }
          setAgentSteps(s => [...s, { kind: 'thinking', label: i === 0 ? 'Generating...' : `Iteration ${i + 1}: fixing...` }])
          setStreamingText('')
          const content = await callLLM(convMessages, (t) => setStreamingText(t))
          lastContent = content
          setStreamingText('')
          const code = extractCode(content)
          if (!code) { setAgentSteps(s => [...s, { kind: 'warn', label: 'No code block found — stopping' }]); break }
          finalCode = code
          updateActive({ code: finalCode })
          setTab('preview')
          setAgentSteps(s => [...s, { kind: 'render', label: `Rendering attempt ${i + 1}` }])
          lastErrorRef.current = 'pending'
          await new Promise(r => setTimeout(r, 2500))
          const err = lastErrorRef.current === 'pending' ? null : lastErrorRef.current
          if (!err) { setAgentSteps(s => [...s, { kind: 'ok', label: '✓ Render succeeded' }]); break }
          setAgentSteps(s => [...s, { kind: 'err', label: `✗ ${err.slice(0, 160)}` }])
          convMessages = [
            ...convMessages,
            { role: 'assistant', content },
            { role: 'user', content: `The component above failed to render with this error:\n\n${err}\n\nReturn the FULL corrected component code in a single \`\`\`jsx block. Do not explain.` },
          ]
          i++
        }

        const aiMsg = { role: 'assistant', content: lastContent }
        const newMessages = [...baseMessages, aiMsg]
        if (finalCode) updateActive({ messages: newMessages, code: finalCode })
        else updateActive({ messages: newMessages })
        toast.success('Agent run complete')
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error(err.message || 'LLM error')
        updateActive({ messages: [...baseMessages, { role: 'assistant', content: `❌ Error: ${err.message}` }] })
      }
    } finally {
      setLoading(false); setStreamingText(''); setTimeout(() => setAgentSteps([]), 4000)
    }
  }

  // Download project as ZIP (multi-file modes)
  const handleDownloadZip = async () => {
    const files = active.files || []
    if (files.length === 0) { toast.error('No files to download'); return }
    const zip = new JSZip()
    files.forEach(f => zip.file(f.path, f.content))
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${active.name.replace(/\s+/g, '-')}.zip`; a.click()
    URL.revokeObjectURL(url)
    toast.success('ZIP downloaded')
  }

  // Push all files in a multi-file project to GitHub
  const handleGitPushAll = async () => {
    if (!settings?.githubToken || !settings?.githubRepo) { toast.error('Set up GitHub in Settings first'); return }
    const files = active.files || []
    if (files.length === 0) { toast.error('No files'); return }
    toast.info(`Pushing ${files.length} files...`)
    let ok = 0
    for (const f of files) {
      try {
        const res = await fetch('/api/sync/github', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: settings.githubToken, repo: settings.githubRepo, branch: settings.githubBranch || 'main',
            path: f.path, content: f.content, message: `DTB: ${active.name} - ${f.path}`,
          }),
        })
        if (res.ok) ok++
      } catch (e) { /* continue */ }
    }
    toast.success(`Pushed ${ok}/${files.length} files to ${settings.githubRepo}`)
  }

  const handleGitPush = async () => {
    if (!settings?.githubToken || !settings?.githubRepo) { toast.error('Set up GitHub in Settings first'); return }
    try {
      const res = await fetch('/api/sync/github', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: settings.githubToken, repo: settings.githubRepo, branch: settings.githubBranch || 'main',
          path: `${active.name.replace(/\s+/g, '-').toLowerCase()}.jsx`,
          content: active.code, message: `Update ${active.name} via DTB`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'GitHub error')
      toast.success(`Pushed to ${settings.githubRepo}`)
    } catch (e) { toast.error(e.message) }
  }

  const iframeSrc = useMemo(() => buildIframeSrc(active?.code || DEFAULT_CODE), [active?.code])

  if (!active || !settings) return <div className="min-h-screen flex items-center justify-center text-neutral-500">Loading...</div>

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 overflow-hidden">
      {/* Top bar */}
      <header className="h-12 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-3 gap-2 shrink-0 bg-white dark:bg-neutral-950">
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-neutral-100 dark:hover:bg-neutral-900" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-neutral-900 dark:bg-white flex items-center justify-center">
            <Hammer className="h-4 w-4 text-white dark:text-neutral-900" />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-sm tracking-wider">DTB</div>
            <div className="text-[9px] text-neutral-500 -mt-0.5">Down To Build</div>
          </div>
          <Separator orientation="vertical" className="h-5 mx-2 bg-neutral-200 dark:bg-neutral-800" />
          <input value={active.name} onChange={(e) => handleRename(active.id, e.target.value)}
            className="bg-transparent text-sm font-medium px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-900 focus:bg-neutral-100 dark:focus:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-700 min-w-[180px]" />
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-neutral-100 dark:hover:bg-neutral-900 relative" onClick={() => setOverridesOpen(true)} title="Project-specific overrides">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {Object.keys(active.overrides || {}).length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-[14px] px-1 rounded-full bg-purple-500 text-[9px] text-white font-bold flex items-center justify-center">{Object.keys(active.overrides).length}</span>
            )}
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={handleGitPush}>
            <Github className="h-3.5 w-3.5 mr-1.5" /> Push
          </Button>
          <Separator orientation="vertical" className="h-5 bg-neutral-200 dark:bg-neutral-800" />
          <Button variant="outline" size="sm" className="h-8 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={handleNewProject}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New
          </Button>
          <Button variant="outline" size="sm" className="h-8 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800" onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save
          </Button>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="h-8 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <SettingsIcon className="h-3.5 w-3.5 mr-1.5" /> Settings
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && (
          <aside className="w-60 border-r border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 bg-white dark:bg-neutral-950">
            <div className="p-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" /> Projects
            </div>
            <ScrollArea className="flex-1">
              <div className="px-2 pb-2 space-y-0.5">
                {projects.map(p => (
                  <div key={p.id} onClick={() => setActiveId(p.id)}
                    className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm ${p.id === activeId ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300'}`}>
                    <span className="truncate flex-1">{p.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }} className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-3 text-[10px] text-neutral-500 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <span>{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
              <span className="inline-flex items-center gap-1">
                {settings.supabaseEnabled ? <Cloud className="h-3 w-3 text-emerald-500" /> : <CloudOff className="h-3 w-3" />}
              </span>
            </div>
          </aside>
        )}

        <main className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={40} minSize={25}>
              <div className="h-full flex flex-col border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
                    {(active.messages || []).length === 0 && !loading && (
                      <div className="text-center py-12">
                        <div className="inline-flex h-12 w-12 rounded-2xl bg-neutral-900 dark:bg-white items-center justify-center mb-3">
                          <Hammer className="h-6 w-6 text-white dark:text-neutral-900" />
                        </div>
                        <h3 className="text-base font-semibold mb-1">Down To Build?</h3>
                        <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                          Describe whatever you want — a component, a fullstack app, a backend, an integration.
                          The Cline-style agent will decide the right architecture, generate the code, render it, and auto-fix errors.
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-3">
                          Output mode: <span className="font-semibold text-neutral-600 dark:text-neutral-300">{OUTPUT_MODES.find(m => m.id === eff.outputMode)?.label}</span>
                          {' · '}
                          <Link href="/settings" className="underline hover:text-neutral-700 dark:hover:text-neutral-200">change</Link>
                        </p>
                      </div>
                    )}
                    {(active.messages || []).map((m, i) => (
                      <Bubble key={i} role={m.role} content={m.content} />
                    ))}
                    {loading && streamingText && (
                      <Bubble role="assistant" content={streamingText} streaming />
                    )}
                    {loading && !streamingText && (
                      <div className="flex gap-2.5">
                        <Avatar role="assistant" />
                        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-3.5 py-2.5 text-sm flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> <span>Thinking...</span>
                        </div>
                      </div>
                    )}
                    {agentSteps.length > 0 && (
                      <div className="ml-10 space-y-1">
                        {agentSteps.map((s, i) => (
                          <div key={i} className={`text-[11px] font-mono px-2 py-1 rounded ${s.kind === 'err' ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30' : s.kind === 'ok' ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30' : s.kind === 'warn' ? 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30' : 'text-neutral-600 bg-neutral-100 dark:text-neutral-400 dark:bg-neutral-900'}`}>
                            {s.label}
                          </div>
                        ))}
                      </div>
                    )}
                    {pendingQuestion && (
                      <QuestionBubble text={pendingQuestion.text} onAnswer={pendingQuestion.resolve} />
                    )}
                    {pendingPause && (
                      <PauseChoiceBubble iter={pendingPause.iter} lastError={pendingPause.lastError} onChoice={pendingPause.resolve} />
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                <div className="border-t border-neutral-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-950">
                  {/* Quick controls — output mode + model picker, inline */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <div className="flex gap-0.5 p-0.5 bg-neutral-100 dark:bg-neutral-900 rounded-md text-[10px]">
                      {OUTPUT_MODES.map(m => (
                        <button key={m.id} onClick={() => setOverride('outputMode', m.id)}
                          title={m.desc}
                          className={`px-2 py-1 rounded ${eff.outputMode === m.id ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}>
                          {m.short || m.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-0.5 p-0.5 bg-neutral-100 dark:bg-neutral-900 rounded-md text-[10px]">
                      <button onClick={() => setOverride('mode', 'ollama')}
                        className={`px-2 py-1 rounded ${eff.mode === 'ollama' ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500'}`}>Ollama</button>
                      <button onClick={() => setOverride('mode', 'api')}
                        className={`px-2 py-1 rounded ${eff.mode === 'api' ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500'}`}>API</button>
                    </div>
                    {eff.mode === 'ollama' ? (
                      <Input
                        value={eff.ollamaModel}
                        onChange={(e) => setOverride('ollamaModel', e.target.value)}
                        placeholder="qwen2.5-coder:7b"
                        className="h-7 text-[10px] w-44 bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
                      />
                    ) : (
                      <>
                        <select value={eff.provider} onChange={(e) => setOverride('provider', e.target.value)}
                          className="h-7 text-[10px] px-1.5 rounded-md bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                          <option value="openai">OpenAI</option>
                          <option value="anthropic">Anthropic</option>
                          <option value="groq">Groq</option>
                          <option value="openrouter">OpenRouter</option>
                        </select>
                        <Input
                          value={eff.apiModel}
                          onChange={(e) => setOverride('apiModel', e.target.value)}
                          placeholder="gpt-4o-mini"
                          className="h-7 text-[10px] w-32 bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800"
                        />
                      </>
                    )}
                    <Link href="/settings" className="text-[10px] text-neutral-400 hover:text-neutral-700 underline ml-auto">advanced ⚙</Link>
                  </div>
                  <div className="relative">
                    <Textarea
                      value={input} onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      placeholder={eff.agentMode ? 'Describe what to build... (Cline agent will iterate)' : 'Describe what to build...'}
                      rows={3} disabled={loading}
                      className="resize-none bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-sm pr-12"
                    />
                    {loading ? (
                      <Button onClick={handleStop} size="icon" className="absolute bottom-2 right-2 h-8 w-8 bg-red-500 hover:bg-red-600 text-white">
                        <Square className="h-3.5 w-3.5 fill-current" />
                      </Button>
                    ) : (
                      <Button onClick={handleSend} disabled={!input.trim()} size="icon"
                        className="absolute bottom-2 right-2 h-8 w-8 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-neutral-500">
                    <span className="flex items-center gap-2">
                      {eff.agentMode && <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400"><Zap className="h-2.5 w-2.5" /> Agent</span>}
                      <span>{eff.mode === 'ollama' ? `Ollama / ${eff.ollamaModel}` : `${eff.provider} / ${eff.apiModel || 'default'}`}</span>
                      {eff.streaming && <span className="text-emerald-600 dark:text-emerald-400">• streaming</span>}
                      {Object.keys(active.overrides || {}).length > 0 && <span className="text-purple-600 dark:text-purple-400">• {Object.keys(active.overrides).length} override</span>}
                    </span>
                    <span>{(active.messages || []).length} messages</span>
                  </div>
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-neutral-200 dark:bg-neutral-900 hover:bg-neutral-400 dark:hover:bg-neutral-600 transition-colors" />

            <Panel defaultSize={60} minSize={30}>
              <div className="h-full flex flex-col bg-white dark:bg-neutral-950">
                <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
                  <div className="border-b border-neutral-200 dark:border-neutral-800 px-3 py-2 flex items-center gap-2 bg-white dark:bg-neutral-950">
                    <TabsList className="bg-neutral-100 dark:bg-neutral-900 h-8">
                      <TabsTrigger value="preview" className="text-xs h-6 data-[state=active]:bg-white data-[state=active]:text-neutral-900 dark:data-[state=active]:bg-neutral-800 dark:data-[state=active]:text-white"><Eye className="h-3.5 w-3.5 mr-1.5" /> Preview</TabsTrigger>
                      <TabsTrigger value="code" className="text-xs h-6 data-[state=active]:bg-white data-[state=active]:text-neutral-900 dark:data-[state=active]:bg-neutral-800 dark:data-[state=active]:text-white"><Code2 className="h-3.5 w-3.5 mr-1.5" /> Code</TabsTrigger>
                      {(eff.outputMode === 'webcontainer' || eff.outputMode === 'local') && (
                        <TabsTrigger value="files" className="text-xs h-6 data-[state=active]:bg-white data-[state=active]:text-neutral-900 dark:data-[state=active]:bg-neutral-800 dark:data-[state=active]:text-white">📁 Files ({(active.files || []).length})</TabsTrigger>
                      )}
                      {eff.outputMode === 'supabase' && (
                        <TabsTrigger value="sql" className="text-xs h-6 data-[state=active]:bg-white data-[state=active]:text-neutral-900 dark:data-[state=active]:bg-neutral-800 dark:data-[state=active]:text-white">🗄 SQL</TabsTrigger>
                      )}
                    </TabsList>
                    <div className="ml-auto flex items-center gap-2">
                      {eff.outputMode === 'webcontainer' && (active.files || []).length > 0 && (
                        <Link href={`/run/${active.id}`} target="_blank" title="Open WebContainer in a dedicated full-screen tab">
                          <Button variant="outline" size="sm" className="h-7 text-xs border-neutral-200 dark:border-neutral-800">
                            ↗ Fullscreen
                          </Button>
                        </Link>
                      )}
                      {(eff.outputMode === 'webcontainer' || eff.outputMode === 'local') && (active.files || []).length > 0 && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-900" onClick={handleDownloadZip}>
                            <Download className="h-3.5 w-3.5 mr-1" /> ZIP
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-900" onClick={handleGitPushAll}>
                            <GitBranch className="h-3.5 w-3.5 mr-1" /> Push all
                          </Button>
                        </>
                      )}
                      {eff.outputMode !== 'webcontainer' && eff.outputMode !== 'local' && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-900"
                            onClick={() => { navigator.clipboard.writeText(active.code || ''); toast.success('Copied') }}>Copy</Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-900"
                            onClick={() => {
                              const blob = new Blob([active.code || ''], { type: 'text/javascript' })
                              const url = URL.createObjectURL(blob); const a = document.createElement('a')
                              a.href = url; a.download = `${active.name.replace(/\s+/g, '-')}.jsx`; a.click(); URL.revokeObjectURL(url)
                            }}><Download className="h-3.5 w-3.5 mr-1" /> .jsx</Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-900" onClick={handleGitPush}>
                            <GitBranch className="h-3.5 w-3.5 mr-1" /> Push
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <TabsContent value="preview" className="flex-1 m-0 p-0 bg-neutral-50 dark:bg-neutral-950">
                    {eff.outputMode === 'webcontainer' ? (
                      (active.files || []).length === 0 ? (
                        <div className="h-full flex items-center justify-center text-center p-8">
                          <div className="max-w-md">
                            <div className="text-5xl mb-3">🚀</div>
                            <h3 className="text-lg font-semibold mb-2">Fullstack project (WebContainer)</h3>
                            <p className="text-sm text-neutral-500">
                              Describe what you want to build in the chat. The AI will generate a multi-file Next.js or Express project, and it will start running here automatically.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <WebContainerRunner project={active} compact runKey={wcRunKey} onLifecycle={wcLifecycle} />
                      )
                    ) : eff.outputMode === 'local' ? (
                      <div className="h-full flex items-center justify-center text-center p-8">
                        <div className="max-w-md">
                          <div className="text-5xl mb-3">📦</div>
                          <h3 className="text-lg font-semibold mb-2">Fullstack project (Local)</h3>
                          <p className="text-sm text-neutral-500">
                            {(active.files || []).length === 0
                              ? 'Describe what you want to build in the chat. The AI will generate a multi-file project.'
                              : `${active.files.length} files generated. Download the ZIP, then run "yarn install && yarn dev" locally. Or push all files to GitHub.`}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <iframe title="preview" key={active.id + '-' + (active.updatedAt || 0)}
                        srcDoc={iframeSrc} sandbox="allow-scripts" className="w-full h-full border-0 bg-white" />
                    )}
                  </TabsContent>
                  <TabsContent value="code" className="flex-1 m-0 p-0 overflow-hidden">
                    <ScrollArea className="h-full bg-neutral-50 dark:bg-neutral-950">
                      <pre className="p-4 text-xs text-neutral-700 dark:text-neutral-300 font-mono leading-relaxed"><code>{active.code}</code></pre>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="files" className="flex-1 m-0 p-0 overflow-hidden">
                    <FileExplorer files={active.files || []} />
                  </TabsContent>
                  <TabsContent value="sql" className="flex-1 m-0 p-0 overflow-hidden">
                    <SqlView sql={active.sql} settings={settings} />
                  </TabsContent>
                </Tabs>
              </div>
            </Panel>
          </PanelGroup>
        </main>
      </div>

      {/* Per-project overrides dialog */}
      <Dialog open={overridesOpen} onOpenChange={setOverridesOpen}>
        <DialogContent className="bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" /> Project: {active.name}</DialogTitle>
            <DialogDescription className="text-neutral-500">
              Override any global setting just for this project. Click <span className="font-semibold">override</span> next to a field to customize, or <span className="font-semibold">inherit</span> to fall back to <a href="/settings" className="underline">global settings</a>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <OverrideRow label="Provider mode" name="mode" eff={eff} overrides={active.overrides} setOverride={setOverride} clearOverride={clearOverride}>
              <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg w-fit">
                <button onClick={() => setOverride('mode', 'ollama')} className={`px-3 py-1 text-xs rounded ${eff.mode === 'ollama' ? 'bg-white dark:bg-neutral-800 shadow-sm' : ''}`}>Ollama</button>
                <button onClick={() => setOverride('mode', 'api')} className={`px-3 py-1 text-xs rounded ${eff.mode === 'api' ? 'bg-white dark:bg-neutral-800 shadow-sm' : ''}`}>External API</button>
              </div>
            </OverrideRow>
            {eff.mode === 'ollama' ? (
              <>
                <OverrideRow label="Ollama Base URL" name="ollamaUrl" eff={eff} overrides={active.overrides} setOverride={setOverride} clearOverride={clearOverride}>
                  <Input value={eff.ollamaUrl} onChange={(e) => setOverride('ollamaUrl', e.target.value)} className="h-8 text-xs w-56" />
                </OverrideRow>
                <OverrideRow label="Ollama Model" name="ollamaModel" eff={eff} overrides={active.overrides} setOverride={setOverride} clearOverride={clearOverride}>
                  <Input value={eff.ollamaModel} onChange={(e) => setOverride('ollamaModel', e.target.value)} className="h-8 text-xs w-56" />
                </OverrideRow>
              </>
            ) : (
              <>
                <OverrideRow label="Provider" name="provider" eff={eff} overrides={active.overrides} setOverride={setOverride} clearOverride={clearOverride}>
                  <Select value={eff.provider} onValueChange={(v) => setOverride('provider', v)}>
                    <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="groq">Groq</SelectItem>
                      <SelectItem value="openrouter">OpenRouter</SelectItem>
                    </SelectContent>
                  </Select>
                </OverrideRow>
                <OverrideRow label="API Key" name="apiKey" eff={eff} overrides={active.overrides} setOverride={setOverride} clearOverride={clearOverride}>
                  <Input type="password" value={eff.apiKey} onChange={(e) => setOverride('apiKey', e.target.value)} className="h-8 text-xs w-56" placeholder="sk-..." />
                </OverrideRow>
                <OverrideRow label="Model" name="apiModel" eff={eff} overrides={active.overrides} setOverride={setOverride} clearOverride={clearOverride}>
                  <Input value={eff.apiModel} onChange={(e) => setOverride('apiModel', e.target.value)} className="h-8 text-xs w-56" />
                </OverrideRow>
              </>
            )}
            <OverrideRow label="Agent Mode" name="agentMode" eff={eff} overrides={active.overrides} setOverride={setOverride} clearOverride={clearOverride}>
              <Switch checked={eff.agentMode} onCheckedChange={(v) => setOverride('agentMode', v)} />
            </OverrideRow>
            <OverrideRow label={`Max iterations: ${eff.maxIterations}`} name="maxIterations" eff={eff} overrides={active.overrides} setOverride={setOverride} clearOverride={clearOverride}>
              <input type="range" min={1} max={5} value={eff.maxIterations} onChange={(e) => setOverride('maxIterations', parseInt(e.target.value))} className="w-40 accent-neutral-900 dark:accent-white" />
            </OverrideRow>
            <OverrideRow label="Streaming" name="streaming" eff={eff} overrides={active.overrides} setOverride={setOverride} clearOverride={clearOverride}>
              <Switch checked={eff.streaming} onCheckedChange={(v) => setOverride('streaming', v)} />
            </OverrideRow>
            <OverrideRow label="System Prompt" name="systemPrompt" eff={eff} overrides={active.overrides} setOverride={setOverride} clearOverride={clearOverride} block>
              <Textarea rows={6} value={eff.systemPrompt} onChange={(e) => setOverride('systemPrompt', e.target.value)} className="font-mono text-[11px] bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800" />
            </OverrideRow>
          </div>
          <DialogFooter className="mt-3">
            <Button variant="outline" onClick={() => updateActive({ overrides: {} })} className="border-neutral-300 dark:border-neutral-800">Clear all overrides</Button>
            <Button onClick={() => setOverridesOpen(false)} className="bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function OverrideRow({ label, name, eff, overrides, setOverride, clearOverride, children, block }) {
  const isOverridden = overrides && Object.prototype.hasOwnProperty.call(overrides, name)
  return (
    <div className={`p-3 rounded-lg border ${isOverridden ? 'border-purple-300 bg-purple-50/50 dark:border-purple-700/50 dark:bg-purple-950/20' : 'border-neutral-200 dark:border-neutral-800'}`}>
      <div className={`${block ? 'mb-2 flex items-center justify-between' : 'flex items-center justify-between gap-3'}`}>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium">{label}</Label>
          {isOverridden && <span className="text-[9px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 rounded">Overridden</span>}
        </div>
        <div className="flex items-center gap-2">
          {!block && <div>{children}</div>}
          {isOverridden ? (
            <button onClick={() => clearOverride(name)} className="text-[10px] text-neutral-500 hover:text-red-500 underline">inherit</button>
          ) : (
            <button onClick={() => setOverride(name, eff[name])} className="text-[10px] text-neutral-500 hover:text-purple-600 underline">override</button>
          )}
        </div>
      </div>
      {block && <div>{children}</div>}
    </div>
  )
}

function Avatar({ role }) {
  return (
    <div className={`h-7 w-7 rounded-lg shrink-0 flex items-center justify-center ${role === 'user' ? 'bg-neutral-200 dark:bg-neutral-800' : 'bg-neutral-900 dark:bg-white'}`}>
      {role === 'user' ? <User className="h-3.5 w-3.5 text-neutral-700 dark:text-neutral-300" /> : <Bot className="h-3.5 w-3.5 text-white dark:text-neutral-900" />}
    </div>
  )
}
function Bubble({ role, content, streaming }) {
  const display = role === 'assistant' ? content.replace(/```[\s\S]*?```/g, '`[generated code → see right panel]`').replace(/```[\s\S]*$/g, '`[generating...]`') : content
  return (
    <div className={`flex gap-2.5 ${role === 'user' ? 'flex-row-reverse' : ''}`}>
      <Avatar role={role} />
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${role === 'user' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800'}`}>
        <div className="whitespace-pre-wrap break-words">
          {display}
          {streaming && <span className="inline-block w-1.5 h-3.5 bg-current ml-0.5 animate-pulse align-middle" />}
        </div>
      </div>
    </div>
  )
}

function FileExplorer({ files }) {
  const [selected, setSelected] = useState(0)
  if (files.length === 0) {
    return <div className="h-full flex items-center justify-center text-sm text-neutral-500 p-8 text-center">No files yet. Generate a multi-file project from the chat.</div>
  }
  const current = files[selected] || files[0]
  return (
    <div className="h-full flex">
      <div className="w-56 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 overflow-y-auto">
        {files.map((f, i) => (
          <button key={i} onClick={() => setSelected(i)}
            className={`w-full text-left px-3 py-1.5 text-xs font-mono truncate hover:bg-neutral-100 dark:hover:bg-neutral-900 ${i === selected ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}>
            {f.path}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto bg-white dark:bg-neutral-950">
        <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-500 sticky top-0 bg-white dark:bg-neutral-950">{current.path}</div>
        <pre className="p-3 text-xs text-neutral-700 dark:text-neutral-300 font-mono leading-relaxed"><code>{current.content}</code></pre>
      </div>
    </div>
  )
}

function SqlView({ sql, settings }) {
  const applySQL = async () => {
    if (!settings?.supabaseUrl || !settings?.supabaseKey) { toast.error('Configure Supabase in /settings first'); return }
    if (!sql) return
    // Supabase REST does not allow arbitrary DDL with anon key. Provide a helpful workflow.
    await navigator.clipboard.writeText(sql)
    toast.success('SQL copied. Paste it into the Supabase SQL Editor.')
    window.open(`${settings.supabaseUrl}/project/_/sql/new`, '_blank')
  }
  if (!sql) return <div className="h-full flex items-center justify-center text-sm text-neutral-500 p-8 text-center">No SQL generated yet. Use Supabase mode to get a schema.</div>
  return (
    <div className="h-full flex flex-col bg-neutral-50 dark:bg-neutral-950">
      <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2">
        <span className="text-xs font-mono text-neutral-500">schema.sql</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(sql); toast.success('Copied') }}>Copy</Button>
          <Button size="sm" className="h-7 text-xs bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900" onClick={applySQL}>
            Apply to Supabase →
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <pre className="p-4 text-xs font-mono text-emerald-700 dark:text-emerald-400 leading-relaxed whitespace-pre-wrap">{sql}</pre>
      </ScrollArea>
      <div className="text-[10px] text-neutral-500 px-3 py-2 border-t border-neutral-200 dark:border-neutral-800">
        Note: Supabase REST does not allow arbitrary DDL with anon keys. Clicking <strong>Apply</strong> copies the SQL and opens the Supabase SQL editor where you paste &amp; run it.
      </div>
    </div>
  )
}


function QuestionBubble({ text, onAnswer }) {
  const [val, setVal] = useState('')
  const submit = () => { if (val.trim()) onAnswer(val.trim()) }
  return (
    <div className="ml-10 my-2 p-3 rounded-xl border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-1.5">🤔 Agent has a question</div>
      <div className="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap mb-2">{text}</div>
      <div className="flex gap-2">
        <Input value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="Your answer..." className="h-8 text-sm bg-white dark:bg-neutral-900" autoFocus />
        <Button size="sm" onClick={submit} className="h-8 bg-blue-600 text-white hover:bg-blue-700">Send</Button>
        <Button size="sm" variant="ghost" onClick={() => onAnswer('')} className="h-8 text-neutral-500">Cancel</Button>
      </div>
    </div>
  )
}

function PauseChoiceBubble({ iter, lastError, onChoice }) {
  return (
    <div className="ml-10 my-2 p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1.5">⏸ Pause — {iter} iterations, still failing</div>
      <div className="text-xs text-neutral-700 dark:text-neutral-300 mb-2">
        Latest error:
      </div>
      <pre className="text-[10px] font-mono bg-white dark:bg-neutral-900 rounded p-2 mb-3 max-h-40 overflow-auto whitespace-pre-wrap text-red-700 dark:text-red-300">{(lastError || '').slice(0, 1500)}</pre>
      <div className="text-xs text-neutral-700 dark:text-neutral-300 mb-2">How do you want to proceed?</div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onChoice('continue')} className="h-8 bg-amber-600 text-white hover:bg-amber-700 text-xs">
          ↻ Try {iter} more iterations
        </Button>
        <Button size="sm" variant="outline" onClick={() => onChoice('search-first')} className="h-8 border-amber-400 text-amber-800 dark:text-amber-200 text-xs">
          🔍 Search the web first, then retry
        </Button>
        <Button size="sm" variant="outline" onClick={() => onChoice('retry-fresh')} className="h-8 border-amber-400 text-amber-800 dark:text-amber-200 text-xs">
          🆕 Restart from scratch (drop conversation)
        </Button>
        <Button size="sm" variant="outline" onClick={() => onChoice('stop')} className="h-8 border-red-300 text-red-700 dark:text-red-300 text-xs">
          ✗ Stop
        </Button>
      </div>
    </div>
  )
}
