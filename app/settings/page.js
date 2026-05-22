'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ArrowLeft, Hammer, Bot, Cloud, Github, FileText, CheckCircle2, XCircle, Loader2, RefreshCw, ExternalLink, Save, RotateCcw } from 'lucide-react'
import { DEFAULT_SETTINGS, DEFAULT_SYSTEM_PROMPT, SETTINGS_KEY, STORAGE_KEY, loadSettings, saveSettings, OUTPUT_MODES } from '@/lib/dtb-store'

const sections = [
  { id: 'llm', label: 'LLM & Agent', icon: Bot },
  { id: 'ollama', label: 'Ollama', icon: Hammer },
  { id: 'supabase', label: 'Supabase', icon: Cloud },
  { id: 'github', label: 'GitHub', icon: Github },
  { id: 'prompt', label: 'System Prompt', icon: FileText },
]

export default function SettingsPage() {
  const [s, setS] = useState(DEFAULT_SETTINGS)
  const [section, setSection] = useState('llm')
  const [ollamaModels, setOllamaModels] = useState([])
  const [testing, setTesting] = useState({})
  const [status, setStatus] = useState({ supabase: null, github: null, ollama: null })

  useEffect(() => { setS(loadSettings()) }, [])
  useEffect(() => { saveSettings(s) }, [s])

  const update = (patch) => setS(prev => ({ ...prev, ...patch }))

  const fetchOllamaModels = async () => {
    setTesting(t => ({ ...t, ollama: true }))
    try {
      const res = await fetch('/api/ollama/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: s.ollamaUrl }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOllamaModels(data.models || [])
      setStatus(st => ({ ...st, ollama: { ok: true, msg: `${data.models?.length || 0} models found` } }))
      toast.success(`Found ${data.models?.length || 0} Ollama models`)
    } catch (e) {
      setStatus(st => ({ ...st, ollama: { ok: false, msg: e.message } }))
      toast.error(e.message)
    } finally { setTesting(t => ({ ...t, ollama: false })) }
  }

  const testSupabase = async () => {
    setTesting(t => ({ ...t, supabase: true }))
    try {
      const res = await fetch('/api/sync/supabase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test', url: s.supabaseUrl, key: s.supabaseKey }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStatus(st => ({ ...st, supabase: { ok: true, msg: 'Connected' } }))
      update({ supabaseEnabled: true })
      toast.success('Supabase connected')
    } catch (e) {
      setStatus(st => ({ ...st, supabase: { ok: false, msg: e.message } }))
      toast.error(e.message)
    } finally { setTesting(t => ({ ...t, supabase: false })) }
  }

  const loginGitHub = async () => {
    setTesting(t => ({ ...t, github: true }))
    try {
      const res = await fetch('/api/sync/github/user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: s.githubToken }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      update({ githubUser: data.login })
      setStatus(st => ({ ...st, github: { ok: true, msg: `Connected as @${data.login}` } }))
      toast.success(`Logged in as @${data.login}`)
    } catch (e) {
      setStatus(st => ({ ...st, github: { ok: false, msg: e.message } }))
      toast.error(e.message)
    } finally { setTesting(t => ({ ...t, github: false })) }
  }

  const pushAllSupabase = async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const projects = raw ? JSON.parse(raw) : []
      const res = await fetch('/api/sync/supabase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'push', url: s.supabaseUrl, key: s.supabaseKey, projects }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Pushed ${data.count} projects`)
    } catch (e) { toast.error(e.message) }
  }
  const pullAllSupabase = async () => {
    try {
      const res = await fetch('/api/sync/supabase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pull', url: s.supabaseUrl, key: s.supabaseKey }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.projects?.length) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data.projects)); toast.success(`Pulled ${data.projects.length} projects — reload workspace`) }
      else toast.info('No remote projects')
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* Top */}
      <header className="h-14 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-4 gap-3 bg-white dark:bg-neutral-950">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to workspace
        </Link>
        <Separator orientation="vertical" className="h-5 bg-neutral-200 dark:bg-neutral-800" />
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-neutral-900 dark:bg-white flex items-center justify-center">
            <Hammer className="h-4 w-4 text-white dark:text-neutral-900" />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-sm tracking-wider">DTB</div>
            <div className="text-[9px] text-neutral-500 -mt-0.5">Settings</div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 grid grid-cols-12 gap-6">
        {/* Side nav */}
        <nav className="col-span-3">
          <div className="sticky top-6 space-y-1">
            {sections.map(sec => {
              const Icon = sec.icon
              return (
                <button key={sec.id} onClick={() => setSection(sec.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${section === sec.id ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-900'}`}>
                  <Icon className="h-4 w-4" /> {sec.label}
                </button>
              )
            })}
            <Separator className="my-3 bg-neutral-200 dark:bg-neutral-800" />
            <button onClick={() => { if (confirm('Reset all settings to defaults?')) setS(DEFAULT_SETTINGS) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-500 hover:text-red-500 transition">
              <RotateCcw className="h-4 w-4" /> Reset to defaults
            </button>
          </div>
        </nav>

        {/* Content */}
        <main className="col-span-9">
          {section === 'llm' && (
            <Card title="LLM Provider & Agent" desc="Choose your model, output mode, and agent behavior.">
              <Field label="Output mode" hint="What the AI generates. Per-project override available from the workspace.">
                <div className="grid grid-cols-2 gap-2">
                  {OUTPUT_MODES.map(m => (
                    <button key={m.id} onClick={() => update({ outputMode: m.id })}
                      className={`text-left p-3 rounded-lg border transition ${s.outputMode === m.id ? 'border-neutral-900 dark:border-white bg-neutral-100 dark:bg-neutral-900' : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50'}`}>
                      <div className="text-sm font-medium">{m.label}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>
              <Separator className="bg-neutral-200 dark:bg-neutral-800" />
              <Field label="Provider mode">
                <div className="flex gap-1 p-1 bg-neutral-200 dark:bg-neutral-900 rounded-lg w-fit">
                  <ModeBtn active={s.mode === 'ollama'} onClick={() => update({ mode: 'ollama' })}>Ollama (Local)</ModeBtn>
                  <ModeBtn active={s.mode === 'api'} onClick={() => update({ mode: 'api' })}>External API</ModeBtn>
                </div>
              </Field>
              {s.mode === 'api' && (
                <>
                  <Field label="API Provider">
                    <Select value={s.provider} onValueChange={(v) => update({ provider: v })}>
                      <SelectTrigger className="h-9 bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 max-w-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="groq">Groq</SelectItem>
                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="API Key" hint="Stored in your browser, sent server-side only via the proxy.">
                    <Input type="password" value={s.apiKey} onChange={(e) => update({ apiKey: e.target.value })} placeholder="sk-..." className="max-w-md" />
                  </Field>
                  <Field label="Model" hint="Leave empty to use the provider default.">
                    <Input value={s.apiModel} onChange={(e) => update({ apiModel: e.target.value })} placeholder="gpt-4o-mini / claude-3-5-sonnet-20241022 / ..." className="max-w-md" />
                  </Field>
                </>
              )}
              <Separator className="bg-neutral-200 dark:bg-neutral-800 my-4" />
              <Field label="Cline Agent Mode" hint="Multi-step: plan → render → capture errors → auto-fix.">
                <div className="flex items-center gap-3">
                  <Switch checked={s.agentMode} onCheckedChange={(v) => update({ agentMode: v })} />
                  <span className="text-sm text-neutral-500">{s.agentMode ? 'Enabled' : 'Disabled'}</span>
                </div>
              </Field>
              {s.agentMode && (
                <Field label={`Max iterations: ${s.maxIterations}`}>
                  <input type="range" min={1} max={5} value={s.maxIterations} onChange={(e) => update({ maxIterations: parseInt(e.target.value) })} className="w-full max-w-md accent-neutral-900 dark:accent-white" />
                </Field>
              )}
              <Field label="Streaming" hint="Stream tokens as they arrive (Ollama / OpenAI / Anthropic / Groq / OpenRouter).">
                <div className="flex items-center gap-3">
                  <Switch checked={s.streaming} onCheckedChange={(v) => update({ streaming: v })} />
                  <span className="text-sm text-neutral-500">{s.streaming ? 'Enabled' : 'Disabled'}</span>
                </div>
              </Field>
            </Card>
          )}

          {section === 'ollama' && (
            <Card title="Ollama (Local)" desc="System variables for your local Ollama server.">
              <Field label="Base URL">
                <Input value={s.ollamaUrl} onChange={(e) => update({ ollamaUrl: e.target.value })} className="max-w-md" placeholder="http://localhost:11434" />
              </Field>
              <Field label="Model name">
                <div className="flex gap-2 max-w-md">
                  <Input value={s.ollamaModel} onChange={(e) => update({ ollamaModel: e.target.value })} placeholder="llama3.2 / qwen2.5-coder:7b" />
                  <Button variant="outline" onClick={fetchOllamaModels} disabled={testing.ollama} className="shrink-0 border-neutral-300 dark:border-neutral-800">
                    {testing.ollama ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
                {status.ollama && <StatusLine ok={status.ollama.ok} msg={status.ollama.msg} />}
                {ollamaModels.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ollamaModels.map(m => (
                      <button key={m} onClick={() => update({ ollamaModel: m })} className={`text-xs px-2 py-1 rounded-md border ${s.ollamaModel === m ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white' : 'bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}>{m}</button>
                    ))}
                  </div>
                )}
              </Field>
              <div className="text-xs text-neutral-500 mt-4 p-3 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <div className="font-mono">$ curl -fsSL https://ollama.com/install.sh | sh</div>
                <div className="font-mono">$ ollama pull qwen2.5-coder:7b</div>
              </div>
            </Card>
          )}

          {section === 'supabase' && (
            <Card title="Supabase" desc="Cross-device project sync. Create a table dtb_projects (id uuid pk, data jsonb, updated_at timestamptz).">
              <Field label="Project URL">
                <Input value={s.supabaseUrl} onChange={(e) => update({ supabaseUrl: e.target.value })} placeholder="https://xxxx.supabase.co" className="max-w-md" />
              </Field>
              <Field label="Anon public key">
                <Input type="password" value={s.supabaseKey} onChange={(e) => update({ supabaseKey: e.target.value })} placeholder="eyJhbGciOi..." className="max-w-md" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button onClick={testSupabase} disabled={testing.supabase || !s.supabaseUrl || !s.supabaseKey} className="bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
                  {testing.supabase ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Log in / Test
                </Button>
                <Button variant="outline" onClick={pushAllSupabase} disabled={!s.supabaseEnabled} className="border-neutral-300 dark:border-neutral-800">Push all ↑</Button>
                <Button variant="outline" onClick={pullAllSupabase} disabled={!s.supabaseEnabled} className="border-neutral-300 dark:border-neutral-800">Pull ↓</Button>
              </div>
              {status.supabase && <StatusLine ok={status.supabase.ok} msg={status.supabase.msg} />}
              <details className="mt-4 text-xs text-neutral-500">
                <summary className="cursor-pointer">Show SQL to create the table</summary>
                <pre className="mt-2 p-3 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">{`create table dtb_projects (
  id uuid primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table dtb_projects disable row level security;`}</pre>
              </details>
            </Card>
          )}

          {section === 'github' && (
            <Card title="GitHub" desc="Push generated components to any repo. Requires a Personal Access Token with repo scope.">
              <Field label="Personal Access Token" hint={<a className="underline inline-flex items-center gap-1" href="https://github.com/settings/tokens/new?scopes=repo&description=DTB" target="_blank" rel="noopener noreferrer">Create one <ExternalLink className="h-3 w-3" /></a>}>
                <Input type="password" value={s.githubToken} onChange={(e) => update({ githubToken: e.target.value })} placeholder="ghp_..." className="max-w-md" />
              </Field>
              <div className="flex gap-2 mb-3">
                <Button onClick={loginGitHub} disabled={testing.github || !s.githubToken} className="bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
                  {testing.github ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Github className="h-4 w-4 mr-2" />} Log in with token
                </Button>
                {s.githubUser && <span className="inline-flex items-center text-sm text-emerald-600 dark:text-emerald-400 gap-1"><CheckCircle2 className="h-4 w-4" /> @{s.githubUser}</span>}
              </div>
              {status.github && <StatusLine ok={status.github.ok} msg={status.github.msg} />}
              <Separator className="my-4 bg-neutral-200 dark:bg-neutral-800" />
              <Field label="Default repository" hint="Format: username/repo-name">
                <Input value={s.githubRepo} onChange={(e) => update({ githubRepo: e.target.value })} placeholder="yourname/dtb-components" className="max-w-md" />
              </Field>
              <Field label="Branch">
                <Input value={s.githubBranch} onChange={(e) => update({ githubBranch: e.target.value })} placeholder="main" className="max-w-md" />
              </Field>
            </Card>
          )}

          {section === 'prompt' && (
            <Card title="System Prompt" desc="Sent at the start of every conversation. Shapes how the agent generates and fixes components.">
              <Textarea value={s.systemPrompt} onChange={(e) => update({ systemPrompt: e.target.value })} rows={18}
                className="font-mono text-xs bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800" />
              <div className="flex gap-2 mt-3">
                <Button variant="outline" onClick={() => update({ systemPrompt: DEFAULT_SYSTEM_PROMPT })} className="border-neutral-300 dark:border-neutral-800">
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restore default
                </Button>
                <Button onClick={() => toast.success('System prompt saved')} className="bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
                  <Save className="h-3.5 w-3.5 mr-1.5" /> Saved
                </Button>
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}

function Card({ title, desc, children }) {
  return (
    <div className="bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-neutral-500 mb-5">{desc}</p>
      <div className="space-y-4">{children}</div>
    </div>
  )
}
function Field({ label, hint, children }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5 block">{label}</Label>
      {children}
      {hint && <div className="text-[11px] text-neutral-500 mt-1">{hint}</div>}
    </div>
  )
}
function ModeBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`px-4 py-1.5 text-sm rounded-md transition ${active ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-600 dark:text-neutral-400'}`}>{children}</button>
  )
}
function StatusLine({ ok, msg }) {
  return (
    <div className={`mt-2 inline-flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} {msg}
    </div>
  )
}
