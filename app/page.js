'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { toast } from 'sonner'
import {
  Plus, Save, FolderOpen, Send, Trash2, Settings as SettingsIcon,
  Code2, Eye, Sparkles, Bot, User, Loader2, ChevronLeft, ChevronRight, Download
} from 'lucide-react'

const STORAGE_KEY = 'boltclone_projects_v1'
const ACTIVE_KEY = 'boltclone_active_v1'

const DEFAULT_CODE = `function App() {
  const { useState } = React;
  const [name, setName] = useState('builder');
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-6xl mb-4">✨</div>
        <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-3">
          Hello, {name}!
        </h1>
        <p className="text-slate-300 mb-6">Describe what you want to build in the chat →</p>
        <input value={name} onChange={(e) => setName(e.target.value)} className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-center" />
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
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react">
try {
${safeCode}
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
} catch (e) {
  document.getElementById('root').innerHTML = '<div style="padding:24px;color:#f87171;font-family:monospace;white-space:pre-wrap">⚠️ Render error:\n' + (e.message || e) + '</div>';
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
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('preview')
  const chatEndRef = useRef(null)

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const list = raw ? JSON.parse(raw) : []
      const aId = localStorage.getItem(ACTIVE_KEY)
      if (list.length === 0) {
        const p = newProject()
        setProjects([p])
        setActiveId(p.id)
      } else {
        setProjects(list)
        setActiveId(aId && list.find(x => x.id === aId) ? aId : list[0].id)
      }
    } catch (e) {
      const p = newProject()
      setProjects([p])
      setActiveId(p.id)
    }
  }, [])

  // Persist projects
  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
    }
  }, [projects])

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
  }, [activeId])

  const active = projects.find(p => p.id === activeId) || projects[0]

  const updateActive = (patch) => {
    setProjects(prev => prev.map(p => p.id === activeId ? { ...p, ...patch, updatedAt: Date.now() } : p))
  }

  const updateConfig = (patch) => {
    setProjects(prev => prev.map(p => p.id === activeId ? { ...p, config: { ...p.config, ...patch }, updatedAt: Date.now() } : p))
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active?.messages?.length, loading])

  const handleNewProject = () => {
    const p = newProject()
    setProjects(prev => [p, ...prev])
    setActiveId(p.id)
    toast.success('New project created')
  }

  const handleSave = () => {
    // Already auto-saved, just confirm
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
    toast.success('Project saved')
  }

  const handleDelete = (id) => {
    if (!confirm('Delete this project?')) return
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id)
      if (next.length === 0) {
        const p = newProject()
        setActiveId(p.id)
        return [p]
      }
      if (id === activeId) setActiveId(next[0].id)
      return next
    })
  }

  const handleRename = (id, name) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p))
  }

  const handleSend = async () => {
    if (!input.trim() || loading || !active) return
    const userMsg = { role: 'user', content: input.trim() }
    const newMessages = [...(active.messages || []), userMsg]
    updateActive({ messages: newMessages })
    setInput('')
    setLoading(true)

    try {
      const cfg = active.config
      const payload = {
        provider: cfg.mode === 'ollama' ? 'ollama' : cfg.provider,
        model: cfg.mode === 'ollama' ? cfg.ollamaModel : cfg.apiModel,
        baseUrl: cfg.ollamaUrl,
        apiKey: cfg.apiKey,
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
      }
      const res = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      const content = data.content || ''
      const code = extractCode(content)
      const aiMsg = { role: 'assistant', content }
      const finalMessages = [...newMessages, aiMsg]
      if (code) {
        updateActive({ messages: finalMessages, code })
        setTab('preview')
        toast.success('Component generated')
      } else {
        updateActive({ messages: finalMessages })
        toast.warning('No code block detected in AI response')
      }
    } catch (err) {
      toast.error(err.message || 'Failed to call LLM')
      updateActive({ messages: [...newMessages, { role: 'assistant', content: `❌ Error: ${err.message}` }] })
    } finally {
      setLoading(false)
    }
  }

  const iframeSrc = useMemo(() => buildIframeSrc(active?.code || DEFAULT_CODE), [active?.code])

  if (!active) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Top bar */}
      <header className="h-12 border-b border-zinc-800 flex items-center px-3 gap-2 shrink-0 bg-zinc-950/80 backdrop-blur">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-sm">BoltClone</span>
          <Separator orientation="vertical" className="h-5 mx-1 bg-zinc-800" />
          <input
            value={active.name}
            onChange={(e) => handleRename(active.id, e.target.value)}
            className="bg-transparent text-sm font-medium px-2 py-1 rounded hover:bg-zinc-900 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-700 min-w-[180px]"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 border-zinc-800 bg-zinc-900 hover:bg-zinc-800" onClick={handleNewProject}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New
          </Button>
          <Button variant="outline" size="sm" className="h-8 border-zinc-800 bg-zinc-900 hover:bg-zinc-800" onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save
          </Button>
          <Button variant="outline" size="sm" className="h-8 border-zinc-800 bg-zinc-900 hover:bg-zinc-800" onClick={() => setSettingsOpen(!settingsOpen)}>
            <SettingsIcon className="h-3.5 w-3.5 mr-1.5" /> Settings
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-60 border-r border-zinc-800 flex flex-col shrink-0 bg-zinc-950">
            <div className="p-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" /> Projects
            </div>
            <ScrollArea className="flex-1">
              <div className="px-2 pb-2 space-y-0.5">
                {projects.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setActiveId(p.id)}
                    className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm ${p.id === activeId ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-900 text-zinc-300'}`}
                  >
                    <span className="truncate flex-1">{p.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-3 text-[10px] text-zinc-500 border-t border-zinc-800">
              Auto-saved locally • {projects.length} project{projects.length !== 1 ? 's' : ''}
            </div>
          </aside>
        )}

        {/* Main workspace */}
        <main className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal" className="h-full">
            {/* Left Panel: Chat + Settings */}
            <Panel defaultSize={40} minSize={25}>
              <div className="h-full flex flex-col border-r border-zinc-800">
                {settingsOpen && (
                  <div className="border-b border-zinc-800 p-3 bg-zinc-950 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">LLM Configuration</h3>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSettingsOpen(false)}>Close</Button>
                    </div>
                    <div className="flex gap-1 p-0.5 bg-zinc-900 rounded-md">
                      <button
                        onClick={() => updateConfig({ mode: 'ollama' })}
                        className={`flex-1 px-3 py-1.5 text-xs rounded ${active.config.mode === 'ollama' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
                      >Ollama (Local)</button>
                      <button
                        onClick={() => updateConfig({ mode: 'api' })}
                        className={`flex-1 px-3 py-1.5 text-xs rounded ${active.config.mode === 'api' ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}
                      >External API</button>
                    </div>
                    {active.config.mode === 'ollama' ? (
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs text-zinc-400">Base URL</Label>
                          <Input value={active.config.ollamaUrl} onChange={(e) => updateConfig({ ollamaUrl: e.target.value })} className="h-8 text-xs bg-zinc-900 border-zinc-800" placeholder="http://localhost:11434" />
                        </div>
                        <div>
                          <Label className="text-xs text-zinc-400">Model Name</Label>
                          <Input value={active.config.ollamaModel} onChange={(e) => updateConfig({ ollamaModel: e.target.value })} className="h-8 text-xs bg-zinc-900 border-zinc-800" placeholder="llama3.2" />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs text-zinc-400">Provider</Label>
                          <Select value={active.config.provider} onValueChange={(v) => updateConfig({ provider: v })}>
                            <SelectTrigger className="h-8 text-xs bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="openai">OpenAI</SelectItem>
                              <SelectItem value="anthropic">Anthropic</SelectItem>
                              <SelectItem value="groq">Groq</SelectItem>
                              <SelectItem value="openrouter">OpenRouter</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-zinc-400">API Key</Label>
                          <Input type="password" value={active.config.apiKey} onChange={(e) => updateConfig({ apiKey: e.target.value })} className="h-8 text-xs bg-zinc-900 border-zinc-800" placeholder="sk-..." />
                        </div>
                        <div>
                          <Label className="text-xs text-zinc-400">Model (optional)</Label>
                          <Input value={active.config.apiModel} onChange={(e) => updateConfig({ apiModel: e.target.value })} className="h-8 text-xs bg-zinc-900 border-zinc-800" placeholder="gpt-4o-mini / claude-3-5-sonnet-20241022 / ..." />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat history */}
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
                    {(active.messages || []).length === 0 && (
                      <div className="text-center py-12">
                        <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 items-center justify-center mb-3">
                          <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        <h3 className="text-base font-semibold mb-1">Build anything</h3>
                        <p className="text-xs text-zinc-500 max-w-xs mx-auto">Describe a React component. The AI will generate it and show a live preview on the right.</p>
                        <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                          {['A pricing table', 'A todo app with animations', 'A weather card', 'A login form'].map(s => (
                            <button key={s} onClick={() => setInput(s)} className="text-xs px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300">{s}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {(active.messages || []).map((m, i) => (
                      <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`h-7 w-7 rounded-lg shrink-0 flex items-center justify-center ${m.role === 'user' ? 'bg-zinc-800' : 'bg-gradient-to-br from-purple-500 to-pink-500'}`}>
                          {m.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5 text-white" />}
                        </div>
                        <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'bg-purple-600 text-white' : 'bg-zinc-900 border border-zinc-800'}`}>
                          <div className="whitespace-pre-wrap break-words">{m.role === 'assistant' ? m.content.replace(/```[\s\S]*?```/g, '`[component code generated → see preview]`') : m.content}</div>
                        </div>
                      </div>
                    ))}
                    {loading && (
                      <div className="flex gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Bot className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-3.5 py-2.5 text-sm flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                {/* Input */}
                <div className="border-t border-zinc-800 p-3 bg-zinc-950">
                  <div className="relative">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      placeholder="Describe what to build... (Shift+Enter for newline)"
                      rows={3}
                      className="resize-none bg-zinc-900 border-zinc-800 text-sm pr-12"
                      disabled={loading}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={loading || !input.trim()}
                      size="icon"
                      className="absolute bottom-2 right-2 h-8 w-8 bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-500">
                    <span>Mode: <span className="text-zinc-300">{active.config.mode === 'ollama' ? `Ollama / ${active.config.ollamaModel}` : `${active.config.provider} / ${active.config.apiModel || 'default'}`}</span></span>
                    <span>{(active.messages || []).length} messages</span>
                  </div>
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-zinc-900 hover:bg-purple-500 transition-colors" />

            {/* Right Panel: Preview / Code */}
            <Panel defaultSize={60} minSize={30}>
              <div className="h-full flex flex-col">
                <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
                  <div className="border-b border-zinc-800 px-3 py-2 flex items-center gap-2 bg-zinc-950">
                    <TabsList className="bg-zinc-900 h-8">
                      <TabsTrigger value="preview" className="text-xs h-6 data-[state=active]:bg-zinc-800">
                        <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
                      </TabsTrigger>
                      <TabsTrigger value="code" className="text-xs h-6 data-[state=active]:bg-zinc-800">
                        <Code2 className="h-3.5 w-3.5 mr-1.5" /> Code
                      </TabsTrigger>
                    </TabsList>
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(active.code || '')
                          toast.success('Code copied')
                        }}
                      >Copy code</Button>
                      <Button
                        variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => {
                          const blob = new Blob([active.code || ''], { type: 'text/javascript' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url; a.download = `${active.name.replace(/\s+/g, '-')}.jsx`; a.click()
                          URL.revokeObjectURL(url)
                        }}
                      ><Download className="h-3.5 w-3.5 mr-1" /> Download</Button>
                    </div>
                  </div>
                  <TabsContent value="preview" className="flex-1 m-0 p-0 bg-zinc-950">
                    <iframe
                      title="preview"
                      key={active.id + '-' + (active.updatedAt || 0)}
                      srcDoc={iframeSrc}
                      sandbox="allow-scripts"
                      className="w-full h-full border-0 bg-white"
                    />
                  </TabsContent>
                  <TabsContent value="code" className="flex-1 m-0 p-0 overflow-hidden">
                    <ScrollArea className="h-full bg-zinc-950">
                      <pre className="p-4 text-xs text-zinc-300 font-mono leading-relaxed"><code>{active.code}</code></pre>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            </Panel>
          </PanelGroup>
        </main>
      </div>
    </div>
  )
}
