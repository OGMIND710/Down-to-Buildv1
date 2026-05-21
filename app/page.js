'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { toast } from 'sonner'
import {
  Plus, Save, FolderOpen, Send, Trash2, Settings as SettingsIcon,
  Code2, Eye, Bot, User, Loader2, ChevronLeft, ChevronRight, Download,
  Terminal, BookOpen, Cloud, CloudOff, Github, GitBranch, Zap, Hammer
} from 'lucide-react'

const STORAGE_KEY = 'dtb_projects_v1'
const ACTIVE_KEY = 'dtb_active_v1'
const SYNC_KEY = 'dtb_sync_config_v1'

const DEFAULT_CODE = `function App() {
  const { useState } = React;
  const [name, setName] = useState('builder');
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-900 to-neutral-800 flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-6xl mb-4">🔨</div>
        <h1 className="text-5xl font-bold text-neutral-100 mb-3">
          Down To Build, {name}?
        </h1>
        <p className="text-neutral-400 mb-6">Describe what you want to build in the chat →</p>
        <input value={name} onChange={(e) => setName(e.target.value)} className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 text-center" />
      </div>
    </div>
  );
}`

function newProject() {
  return {
    id: uuidv4(),
    name: 'Untitled Project',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    code: DEFAULT_CODE,
    config: {
      mode: 'ollama',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'llama3.2',
      provider: 'openai',
      apiKey: '',
      apiModel: '',
      agentMode: true,
      maxIterations: 3,
    },
  }
}

function extractCode(text) {
  const m = text.match(/```(?:jsx|js|javascript|tsx)?\n?([\s\S]*?)```/)
  return m ? m[1].trim() : null
}

function buildIframeSrc(code) {
  const safeCode = (code || '').replace(/<\/script>/g, '<\\/script>')
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<style>html,body,#root{margin:0;padding:0;min-height:100vh;background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif}</style>
<script>
window.addEventListener('error', (e) => {
  parent.postMessage({ __dtb_error: true, message: e.message, stack: (e.error && e.error.stack) || '' }, '*');
});
</script>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react">
try {
${safeCode}
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
  parent.postMessage({ __dtb_ok: true }, '*');
} catch (e) {
  document.getElementById('root').innerHTML = '<div style="padding:24px;color:#f87171;font-family:monospace;white-space:pre-wrap">⚠️ Render error:\\n' + (e.message || e) + '</div>';
  parent.postMessage({ __dtb_error: true, message: (e.message || String(e)), stack: e.stack || '' }, '*');
}
</script>
</body>
</html>`
}

export default function App() {
  const [projects, setProjects] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [clineHelpOpen, setClineHelpOpen] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [agentSteps, setAgentSteps] = useState([])
  const [tab, setTab] = useState('preview')
  const [syncConfig, setSyncConfig] = useState({
    supabaseUrl: '', supabaseKey: '', supabaseEnabled: false,
    githubToken: '', githubRepo: '', githubBranch: 'main',
  })
  const chatEndRef = useRef(null)
  const lastErrorRef = useRef(null)

  // Load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const list = raw ? JSON.parse(raw) : []
      const aId = localStorage.getItem(ACTIVE_KEY)
      if (list.length === 0) {
        const p = newProject()
        setProjects([p]); setActiveId(p.id)
      } else {
        setProjects(list)
        setActiveId(aId && list.find(x => x.id === aId) ? aId : list[0].id)
      }
      const sRaw = localStorage.getItem(SYNC_KEY)
      if (sRaw) setSyncConfig(JSON.parse(sRaw))
    } catch (e) {
      const p = newProject(); setProjects([p]); setActiveId(p.id)
    }
  }, [])

  useEffect(() => { if (projects.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)) }, [projects])
  useEffect(() => { if (activeId) localStorage.setItem(ACTIVE_KEY, activeId) }, [activeId])
  useEffect(() => { localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig)) }, [syncConfig])

  // Iframe error listener
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
  const updateConfig = (patch) => setProjects(prev => prev.map(p => p.id === activeId ? { ...p, config: { ...p.config, ...patch }, updatedAt: Date.now() } : p))

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [active?.messages?.length, loading, agentSteps.length])

  const handleNewProject = () => {
    const p = newProject(); setProjects(prev => [p, ...prev]); setActiveId(p.id)
    toast.success('New project created')
  }
  const handleSave = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); toast.success('Project saved locally') }
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

  // Core LLM call
  const callLLM = useCallback(async (messages, cfg) => {
    const payload = {
      provider: cfg.mode === 'ollama' ? 'ollama' : cfg.provider,
      model: cfg.mode === 'ollama' ? cfg.ollamaModel : cfg.apiModel,
      baseUrl: cfg.ollamaUrl,
      apiKey: cfg.apiKey,
      messages,
    }
    const res = await fetch('/api/llm/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data.content || ''
  }, [])

  const handleSend = async () => {
    if (!input.trim() || loading || !active) return
    const userMsg = { role: 'user', content: input.trim() }
    const baseMessages = [...(active.messages || []), userMsg]
    updateActive({ messages: baseMessages })
    setInput(''); setLoading(true); setAgentSteps([])

    const cfg = active.config
    try {
      if (!cfg.agentMode) {
        // Simple single-shot
        const content = await callLLM(baseMessages.map(m => ({ role: m.role, content: m.content })), cfg)
        const code = extractCode(content)
        const aiMsg = { role: 'assistant', content }
        if (code) {
          updateActive({ messages: [...baseMessages, aiMsg], code })
          setTab('preview'); toast.success('Component generated')
        } else {
          updateActive({ messages: [...baseMessages, aiMsg] })
          toast.warning('No code block detected')
        }
      } else {
        // Cline-style agent loop: Plan → Act → Verify → Iterate on errors
        let convMessages = baseMessages.map(m => ({ role: m.role, content: m.content }))
        let finalCode = null
        let lastContent = ''
        const maxIter = Math.max(1, Math.min(5, cfg.maxIterations || 3))

        for (let i = 0; i < maxIter; i++) {
          setAgentSteps(s => [...s, { kind: 'thinking', label: i === 0 ? 'Planning & coding...' : `Iteration ${i+1}: fixing errors...` }])
          const content = await callLLM(convMessages, cfg)
          lastContent = content
          const code = extractCode(content)
          if (!code) {
            setAgentSteps(s => [...s, { kind: 'warn', label: 'No code in response — stopping' }])
            break
          }
          finalCode = code
          // Render and wait briefly for iframe to report
          updateActive({ code: finalCode })
          setTab('preview')
          setAgentSteps(s => [...s, { kind: 'render', label: `Rendering (attempt ${i+1})` }])
          lastErrorRef.current = 'pending'
          await new Promise(r => setTimeout(r, 2500))
          const err = lastErrorRef.current === 'pending' ? null : lastErrorRef.current
          if (!err) {
            setAgentSteps(s => [...s, { kind: 'ok', label: '✓ Render succeeded' }])
            break
          }
          setAgentSteps(s => [...s, { kind: 'err', label: `✗ Render error: ${err.slice(0, 120)}` }])
          // Feed error back
          convMessages = [
            ...convMessages,
            { role: 'assistant', content },
            { role: 'user', content: `The component above failed to render with this error:\n\n${err}\n\nReturn the FULL corrected component code in a single \`\`\`jsx block. Do not explain.` },
          ]
          if (i === maxIter - 1) {
            setAgentSteps(s => [...s, { kind: 'warn', label: 'Max iterations reached' }])
          }
        }

        const aiMsg = { role: 'assistant', content: lastContent }
        const newMessages = [...baseMessages, aiMsg]
        if (finalCode) updateActive({ messages: newMessages, code: finalCode })
        else updateActive({ messages: newMessages })
        toast.success('Agent run complete')
      }
    } catch (err) {
      toast.error(err.message || 'LLM error')
      updateActive({ messages: [...baseMessages, { role: 'assistant', content: `❌ Error: ${err.message}` }] })
    } finally {
      setLoading(false)
      setTimeout(() => setAgentSteps([]), 4000)
    }
  }

  // Supabase sync
  const supabaseFetch = async (action) => {
    const res = await fetch('/api/sync/supabase', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, url: syncConfig.supabaseUrl, key: syncConfig.supabaseKey, projects }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Supabase error')
    return data
  }
  const handleSyncPush = async () => {
    try { await supabaseFetch('push'); toast.success('Synced to Supabase ☁️') }
    catch (e) { toast.error(e.message) }
  }
  const handleSyncPull = async () => {
    try {
      const data = await supabaseFetch('pull')
      if (data.projects?.length) { setProjects(data.projects); setActiveId(data.projects[0].id); toast.success(`Pulled ${data.projects.length} projects`) }
      else toast.info('No remote projects')
    } catch (e) { toast.error(e.message) }
  }

  // GitHub push
  const handleGitPush = async () => {
    if (!syncConfig.githubToken || !syncConfig.githubRepo) { toast.error('Configure GitHub in Sync settings'); return }
    try {
      const res = await fetch('/api/sync/github', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: syncConfig.githubToken, repo: syncConfig.githubRepo, branch: syncConfig.githubBranch || 'main',
          path: `${active.name.replace(/\s+/g, '-').toLowerCase()}.jsx`,
          content: active.code, message: `Update ${active.name} via DTB`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'GitHub error')
      toast.success(`Pushed to ${syncConfig.githubRepo} 🚀`)
    } catch (e) { toast.error(e.message) }
  }

  const iframeSrc = useMemo(() => buildIframeSrc(active?.code || DEFAULT_CODE), [active?.code])

  if (!active) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* Top bar */}
      <header className="h-12 border-b border-neutral-800 flex items-center px-3 gap-2 shrink-0 bg-neutral-950">
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-neutral-900" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-neutral-800 border border-neutral-700 flex items-center justify-center">
            <Hammer className="h-4 w-4 text-neutral-300" />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-sm tracking-wider">DTB</div>
            <div className="text-[9px] text-neutral-500 -mt-0.5">Down To Build</div>
          </div>
          <Separator orientation="vertical" className="h-5 mx-2 bg-neutral-800" />
          <input
            value={active.name}
            onChange={(e) => handleRename(active.id, e.target.value)}
            className="bg-transparent text-sm font-medium px-2 py-1 rounded hover:bg-neutral-900 focus:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-700 min-w-[180px]"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 border-neutral-800 bg-neutral-900 hover:bg-neutral-800" onClick={() => setClineHelpOpen(true)}>
            <Terminal className="h-3.5 w-3.5 mr-1.5" /> Cline Setup
          </Button>
          <Button variant="outline" size="sm" className="h-8 border-neutral-800 bg-neutral-900 hover:bg-neutral-800" onClick={() => setSyncOpen(true)}>
            {syncConfig.supabaseEnabled ? <Cloud className="h-3.5 w-3.5 mr-1.5 text-emerald-400" /> : <CloudOff className="h-3.5 w-3.5 mr-1.5" />} Sync
          </Button>
          <Button variant="outline" size="sm" className="h-8 border-neutral-800 bg-neutral-900 hover:bg-neutral-800" onClick={handleGitPush}>
            <Github className="h-3.5 w-3.5 mr-1.5" /> Push
          </Button>
          <Separator orientation="vertical" className="h-5 bg-neutral-800" />
          <Button variant="outline" size="sm" className="h-8 border-neutral-800 bg-neutral-900 hover:bg-neutral-800" onClick={handleNewProject}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New
          </Button>
          <Button variant="outline" size="sm" className="h-8 border-neutral-800 bg-neutral-900 hover:bg-neutral-800" onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save
          </Button>
          <Button variant="outline" size="sm" className="h-8 border-neutral-800 bg-neutral-900 hover:bg-neutral-800" onClick={() => setSettingsOpen(!settingsOpen)}>
            <SettingsIcon className="h-3.5 w-3.5 mr-1.5" /> Settings
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && (
          <aside className="w-60 border-r border-neutral-800 flex flex-col shrink-0 bg-neutral-950">
            <div className="p-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" /> Projects
            </div>
            <ScrollArea className="flex-1">
              <div className="px-2 pb-2 space-y-0.5">
                {projects.map(p => (
                  <div key={p.id} onClick={() => setActiveId(p.id)}
                    className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm ${p.id === activeId ? 'bg-neutral-800 text-white' : 'hover:bg-neutral-900 text-neutral-300'}`}>
                    <span className="truncate flex-1">{p.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }} className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-3 text-[10px] text-neutral-500 border-t border-neutral-800 flex items-center justify-between">
              <span>{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
              {syncConfig.supabaseEnabled && (
                <div className="flex gap-1">
                  <button onClick={handleSyncPush} className="hover:text-emerald-400" title="Push to Supabase">↑</button>
                  <button onClick={handleSyncPull} className="hover:text-emerald-400" title="Pull from Supabase">↓</button>
                </div>
              )}
            </div>
          </aside>
        )}

        <main className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={40} minSize={25}>
              <div className="h-full flex flex-col border-r border-neutral-800">
                {settingsOpen && (
                  <div className="border-b border-neutral-800 p-3 bg-neutral-950 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">LLM Configuration</h3>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSettingsOpen(false)}>Close</Button>
                    </div>
                    <div className="flex gap-1 p-0.5 bg-neutral-900 rounded-md">
                      <button onClick={() => updateConfig({ mode: 'ollama' })}
                        className={`flex-1 px-3 py-1.5 text-xs rounded ${active.config.mode === 'ollama' ? 'bg-neutral-800 text-white' : 'text-neutral-400'}`}>Ollama (Local)</button>
                      <button onClick={() => updateConfig({ mode: 'api' })}
                        className={`flex-1 px-3 py-1.5 text-xs rounded ${active.config.mode === 'api' ? 'bg-neutral-800 text-white' : 'text-neutral-400'}`}>External API</button>
                    </div>
                    {active.config.mode === 'ollama' ? (
                      <div className="space-y-2">
                        <div><Label className="text-xs text-neutral-400">Base URL</Label>
                          <Input value={active.config.ollamaUrl} onChange={(e) => updateConfig({ ollamaUrl: e.target.value })} className="h-8 text-xs bg-neutral-900 border-neutral-800" /></div>
                        <div><Label className="text-xs text-neutral-400">Model</Label>
                          <Input value={active.config.ollamaModel} onChange={(e) => updateConfig({ ollamaModel: e.target.value })} className="h-8 text-xs bg-neutral-900 border-neutral-800" /></div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div><Label className="text-xs text-neutral-400">Provider</Label>
                          <Select value={active.config.provider} onValueChange={(v) => updateConfig({ provider: v })}>
                            <SelectTrigger className="h-8 text-xs bg-neutral-900 border-neutral-800"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="openai">OpenAI</SelectItem>
                              <SelectItem value="anthropic">Anthropic</SelectItem>
                              <SelectItem value="groq">Groq</SelectItem>
                              <SelectItem value="openrouter">OpenRouter</SelectItem>
                            </SelectContent>
                          </Select></div>
                        <div><Label className="text-xs text-neutral-400">API Key</Label>
                          <Input type="password" value={active.config.apiKey} onChange={(e) => updateConfig({ apiKey: e.target.value })} className="h-8 text-xs bg-neutral-900 border-neutral-800" placeholder="sk-..." /></div>
                        <div><Label className="text-xs text-neutral-400">Model</Label>
                          <Input value={active.config.apiModel} onChange={(e) => updateConfig({ apiModel: e.target.value })} className="h-8 text-xs bg-neutral-900 border-neutral-800" placeholder="gpt-4o-mini" /></div>
                      </div>
                    )}
                    <Separator className="bg-neutral-800" />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-amber-400" /> Cline Agent Mode</Label>
                        <p className="text-[10px] text-neutral-500 mt-0.5">Multi-step: plan → render → auto-fix errors</p>
                      </div>
                      <Switch checked={active.config.agentMode} onCheckedChange={(v) => updateConfig({ agentMode: v })} />
                    </div>
                    {active.config.agentMode && (
                      <div>
                        <Label className="text-xs text-neutral-400">Max iterations: {active.config.maxIterations}</Label>
                        <input type="range" min={1} max={5} value={active.config.maxIterations}
                          onChange={(e) => updateConfig({ maxIterations: parseInt(e.target.value) })}
                          className="w-full accent-neutral-400" />
                      </div>
                    )}
                  </div>
                )}

                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
                    {(active.messages || []).length === 0 && (
                      <div className="text-center py-12">
                        <div className="inline-flex h-12 w-12 rounded-2xl bg-neutral-800 border border-neutral-700 items-center justify-center mb-3">
                          <Hammer className="h-6 w-6 text-neutral-300" />
                        </div>
                        <h3 className="text-base font-semibold mb-1">Down To Build?</h3>
                        <p className="text-xs text-neutral-500 max-w-xs mx-auto">Describe a React component. The Cline-style agent will generate it, render it, and auto-fix errors.</p>
                        <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                          {['A pricing table', 'A todo app with animations', 'A weather card', 'A login form'].map(s => (
                            <button key={s} onClick={() => setInput(s)} className="text-xs px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300">{s}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {(active.messages || []).map((m, i) => (
                      <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`h-7 w-7 rounded-lg shrink-0 flex items-center justify-center ${m.role === 'user' ? 'bg-neutral-800' : 'bg-neutral-700 border border-neutral-600'}`}>
                          {m.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                        </div>
                        <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'bg-neutral-200 text-neutral-900' : 'bg-neutral-900 border border-neutral-800'}`}>
                          <div className="whitespace-pre-wrap break-words">{m.role === 'assistant' ? m.content.replace(/```[\s\S]*?```/g, '`[component code → see preview]`') : m.content}</div>
                        </div>
                      </div>
                    ))}
                    {loading && (
                      <div className="space-y-2">
                        <div className="flex gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-neutral-700 border border-neutral-600 flex items-center justify-center">
                            <Bot className="h-3.5 w-3.5" />
                          </div>
                          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl px-3.5 py-2.5 text-sm flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Agent working...</span>
                          </div>
                        </div>
                        {agentSteps.length > 0 && (
                          <div className="ml-10 space-y-1">
                            {agentSteps.map((s, i) => (
                              <div key={i} className={`text-[11px] font-mono px-2 py-1 rounded ${s.kind === 'err' ? 'text-red-400 bg-red-950/30' : s.kind === 'ok' ? 'text-emerald-400 bg-emerald-950/30' : s.kind === 'warn' ? 'text-amber-400 bg-amber-950/30' : 'text-neutral-400 bg-neutral-900'}`}>
                                {s.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                <div className="border-t border-neutral-800 p-3 bg-neutral-950">
                  <div className="relative">
                    <Textarea
                      value={input} onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      placeholder={active.config.agentMode ? 'Describe what to build... (Cline agent will iterate)' : 'Describe what to build... (Shift+Enter for newline)'}
                      rows={3} disabled={loading}
                      className="resize-none bg-neutral-900 border-neutral-800 text-sm pr-12"
                    />
                    <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon"
                      className="absolute bottom-2 right-2 h-8 w-8 bg-neutral-200 hover:bg-white text-neutral-900">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-neutral-500">
                    <span>
                      {active.config.agentMode && <span className="text-amber-400">⚡ Agent · </span>}
                      {active.config.mode === 'ollama' ? `Ollama / ${active.config.ollamaModel}` : `${active.config.provider} / ${active.config.apiModel || 'default'}`}
                    </span>
                    <span>{(active.messages || []).length} messages</span>
                  </div>
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-neutral-900 hover:bg-neutral-600 transition-colors" />

            <Panel defaultSize={60} minSize={30}>
              <div className="h-full flex flex-col">
                <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
                  <div className="border-b border-neutral-800 px-3 py-2 flex items-center gap-2 bg-neutral-950">
                    <TabsList className="bg-neutral-900 h-8">
                      <TabsTrigger value="preview" className="text-xs h-6 data-[state=active]:bg-neutral-800"><Eye className="h-3.5 w-3.5 mr-1.5" /> Preview</TabsTrigger>
                      <TabsTrigger value="code" className="text-xs h-6 data-[state=active]:bg-neutral-800"><Code2 className="h-3.5 w-3.5 mr-1.5" /> Code</TabsTrigger>
                    </TabsList>
                    <div className="ml-auto flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs hover:bg-neutral-900"
                        onClick={() => { navigator.clipboard.writeText(active.code || ''); toast.success('Copied') }}>Copy</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs hover:bg-neutral-900"
                        onClick={() => {
                          const blob = new Blob([active.code || ''], { type: 'text/javascript' })
                          const url = URL.createObjectURL(blob); const a = document.createElement('a')
                          a.href = url; a.download = `${active.name.replace(/\s+/g, '-')}.jsx`; a.click()
                          URL.revokeObjectURL(url)
                        }}><Download className="h-3.5 w-3.5 mr-1" /> .jsx</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs hover:bg-neutral-900" onClick={handleGitPush}>
                        <GitBranch className="h-3.5 w-3.5 mr-1" /> Push
                      </Button>
                    </div>
                  </div>
                  <TabsContent value="preview" className="flex-1 m-0 p-0 bg-neutral-950">
                    <iframe title="preview" key={active.id + '-' + (active.updatedAt || 0)}
                      srcDoc={iframeSrc} sandbox="allow-scripts" className="w-full h-full border-0 bg-white" />
                  </TabsContent>
                  <TabsContent value="code" className="flex-1 m-0 p-0 overflow-hidden">
                    <ScrollArea className="h-full bg-neutral-950">
                      <pre className="p-4 text-xs text-neutral-300 font-mono leading-relaxed"><code>{active.code}</code></pre>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            </Panel>
          </PanelGroup>
        </main>
      </div>

      {/* Cline Setup Dialog */}
      <Dialog open={clineHelpOpen} onOpenChange={setClineHelpOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Terminal className="h-5 w-5" /> Cline + Local AI Setup</DialogTitle>
            <DialogDescription className="text-neutral-400">
              DTB has a built-in <span className="text-amber-400">Cline-inspired agent loop</span> (toggle in Settings). For the full IDE-level Cline experience, install the VS Code extension and connect it to your local Ollama.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> 1. Install Cline in VS Code</h4>
              <ol className="list-decimal list-inside space-y-1 text-neutral-300 text-xs ml-2">
                <li>Open VS Code → Extensions panel (Ctrl+Shift+X)</li>
                <li>Search for <span className="font-mono bg-neutral-900 px-1.5 py-0.5 rounded">Cline</span> by saoudrizwan</li>
                <li>Click <span className="text-emerald-400">Install</span> (or use CLI below)</li>
              </ol>
              <pre className="bg-neutral-900 border border-neutral-800 rounded-md p-2 text-[11px] font-mono mt-2 overflow-x-auto">code --install-extension saoudrizwan.claude-dev</pre>
            </div>
            <div>
              <h4 className="font-semibold mb-2">2. Install & start Ollama</h4>
              <pre className="bg-neutral-900 border border-neutral-800 rounded-md p-2 text-[11px] font-mono overflow-x-auto">{`# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Pull a coding model
ollama pull qwen2.5-coder:7b

# Ollama auto-starts at http://localhost:11434`}</pre>
            </div>
            <div>
              <h4 className="font-semibold mb-2">3. Configure Cline to use Ollama</h4>
              <ol className="list-decimal list-inside space-y-1 text-neutral-300 text-xs ml-2">
                <li>Open the Cline panel (sidebar icon)</li>
                <li>Click the <span className="font-mono">⚙</span> settings gear</li>
                <li>API Provider → <span className="text-amber-400">Ollama</span></li>
                <li>Base URL → <span className="font-mono bg-neutral-900 px-1 rounded">http://localhost:11434</span></li>
                <li>Model → <span className="font-mono bg-neutral-900 px-1 rounded">qwen2.5-coder:7b</span></li>
                <li>Hit save and start chatting — Cline will plan, edit files, and run commands autonomously</li>
              </ol>
            </div>
            <div className="border-t border-neutral-800 pt-3">
              <h4 className="font-semibold mb-1 flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-400" /> Use the in-app Agent Mode</h4>
              <p className="text-xs text-neutral-400">DTB's Cline-style agent runs <span className="text-neutral-200">inside this app</span>: it generates, renders, captures errors, and iterates automatically. Toggle it under <span className="text-neutral-200">Settings → Cline Agent Mode</span>.</p>
            </div>
            <a href="https://github.com/cline/cline" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-100 underline">
              <Github className="h-3.5 w-3.5" /> github.com/cline/cline
            </a>
          </div>
          <DialogFooter>
            <Button onClick={() => setClineHelpOpen(false)} className="bg-neutral-200 text-neutral-900 hover:bg-white">Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync Dialog */}
      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Cloud className="h-5 w-5" /> Cloud Sync & Git</DialogTitle>
            <DialogDescription className="text-neutral-400">Connect Supabase for cross-device sync and GitHub for code push.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm flex items-center gap-1.5"><Cloud className="h-4 w-4 text-emerald-400" /> Supabase</h4>
                <Switch checked={syncConfig.supabaseEnabled} onCheckedChange={(v) => setSyncConfig(c => ({ ...c, supabaseEnabled: v }))} />
              </div>
              <Input placeholder="https://xxxx.supabase.co" value={syncConfig.supabaseUrl} onChange={(e) => setSyncConfig(c => ({ ...c, supabaseUrl: e.target.value }))} className="h-8 text-xs bg-neutral-900 border-neutral-800" />
              <Input placeholder="anon public key" type="password" value={syncConfig.supabaseKey} onChange={(e) => setSyncConfig(c => ({ ...c, supabaseKey: e.target.value }))} className="h-8 text-xs bg-neutral-900 border-neutral-800" />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs bg-neutral-200 text-neutral-900 hover:bg-white" onClick={handleSyncPush}>Push all ↑</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs border-neutral-800 bg-neutral-900" onClick={handleSyncPull}>Pull ↓</Button>
              </div>
              <p className="text-[10px] text-neutral-500">Create a <span className="font-mono">dtb_projects</span> table with columns: <span className="font-mono">id (uuid pk), data (jsonb), updated_at (timestamptz)</span>. RLS disabled or anon policy allowed.</p>
            </div>
            <Separator className="bg-neutral-800" />
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-1.5"><Github className="h-4 w-4" /> GitHub</h4>
              <Input placeholder="GitHub Personal Access Token (repo scope)" type="password" value={syncConfig.githubToken} onChange={(e) => setSyncConfig(c => ({ ...c, githubToken: e.target.value }))} className="h-8 text-xs bg-neutral-900 border-neutral-800" />
              <Input placeholder="username/repo-name" value={syncConfig.githubRepo} onChange={(e) => setSyncConfig(c => ({ ...c, githubRepo: e.target.value }))} className="h-8 text-xs bg-neutral-900 border-neutral-800" />
              <Input placeholder="main" value={syncConfig.githubBranch} onChange={(e) => setSyncConfig(c => ({ ...c, githubBranch: e.target.value }))} className="h-8 text-xs bg-neutral-900 border-neutral-800" />
              <Button size="sm" className="h-7 text-xs bg-neutral-200 text-neutral-900 hover:bg-white" onClick={handleGitPush}>Push current project to GitHub</Button>
              <p className="text-[10px] text-neutral-500">Get a token at <a className="underline" href="https://github.com/settings/tokens/new?scopes=repo&description=DTB" target="_blank" rel="noopener noreferrer">github.com/settings/tokens</a> with <span className="font-mono">repo</span> scope.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
