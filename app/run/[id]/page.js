'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ArrowLeft, Hammer, Loader2, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react'
import { STORAGE_KEY } from '@/lib/dtb-store'

function buildFileTree(files) {
  const tree = {}
  for (const file of files) {
    const segments = file.path.split('/').filter(Boolean)
    let current = tree
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const isLast = i === segments.length - 1
      if (isLast) {
        current[seg] = { file: { contents: file.content } }
      } else {
        if (!current[seg]) current[seg] = { directory: {} }
        current = current[seg].directory
      }
    }
  }
  return tree
}

export default function RunPage() {
  const params = useParams()
  const projectId = params?.id
  const [project, setProject] = useState(null)
  const [status, setStatus] = useState('idle') // idle | booting | mounting | installing | running | ready | error
  const [previewUrl, setPreviewUrl] = useState(null)
  const [log, setLog] = useState('')
  const [error, setError] = useState(null)
  const [isolated, setIsolated] = useState(null)
  const wcRef = useRef(null)
  const bootedRef = useRef(false)
  const logEndRef = useRef(null)

  useEffect(() => {
    setIsolated(typeof self !== 'undefined' ? self.crossOriginIsolated : null)
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const list = raw ? JSON.parse(raw) : []
      const p = list.find(x => x.id === projectId)
      setProject(p || null)
    } catch (e) { setProject(null) }
  }, [projectId])

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [log])

  const appendLog = (s) => setLog(prev => prev + s)

  const startContainer = async () => {
    if (!project || !project.files || project.files.length === 0) return
    if (bootedRef.current) return
    bootedRef.current = true
    setError(null); setStatus('booting'); setLog('')

    try {
      appendLog('→ Importing WebContainer API...\n')
      const { WebContainer } = await import('@webcontainer/api')
      appendLog('→ Booting WebContainer (one-time, may take ~10s)...\n')
      const wc = await WebContainer.boot()
      wcRef.current = wc

      setStatus('mounting')
      appendLog(`→ Mounting ${project.files.length} files...\n`)
      await wc.mount(buildFileTree(project.files))
      for (const f of project.files) appendLog(`  ✓ ${f.path}\n`)

      // Detect package manager command + install
      setStatus('installing')
      appendLog('\n→ Running: npm install\n')
      const install = await wc.spawn('npm', ['install'])
      install.output.pipeTo(new WritableStream({ write: (d) => appendLog(d) }))
      const code = await install.exit
      if (code !== 0) throw new Error(`npm install failed (exit ${code})`)
      appendLog('\n✓ Dependencies installed.\n')

      // Determine dev command
      const pkgFile = project.files.find(f => f.path === 'package.json')
      let devScript = 'dev'
      try { const pkg = JSON.parse(pkgFile.content); if (pkg.scripts && !pkg.scripts.dev && pkg.scripts.start) devScript = 'start' } catch (e) { /* ignore */ }

      setStatus('running')
      appendLog(`\n→ Running: npm run ${devScript}\n`)
      const dev = await wc.spawn('npm', ['run', devScript])
      dev.output.pipeTo(new WritableStream({ write: (d) => appendLog(d) }))

      wc.on('server-ready', (port, url) => {
        appendLog(`\n✓ Server ready at ${url} (port ${port})\n`)
        setPreviewUrl(url); setStatus('ready')
      })
    } catch (e) {
      console.error(e)
      setError(e.message || String(e))
      setStatus('error')
      appendLog(`\n✗ Error: ${e.message || e}\n`)
      bootedRef.current = false
    }
  }

  const restart = async () => {
    if (wcRef.current) { try { await wcRef.current.teardown() } catch (e) {} }
    wcRef.current = null; bootedRef.current = false; setPreviewUrl(null); setStatus('idle')
    setTimeout(startContainer, 100)
  }

  if (!projectId) return <div className="min-h-screen flex items-center justify-center">No project id</div>
  if (project === null && projectId) {
    return <div className="min-h-screen flex items-center justify-center">Loading project...</div>
  }
  if (!project) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-3">
      <p className="text-neutral-500">Project not found in localStorage.</p>
      <Link href="/" className="text-sm underline">Back to workspace</Link>
    </div>
  )

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-50 text-neutral-900 overflow-hidden">
      <header className="h-12 border-b border-neutral-200 flex items-center px-3 gap-2 shrink-0 bg-white">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="h-7 w-7 ml-2 rounded-md bg-neutral-900 flex items-center justify-center">
          <Hammer className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <div className="font-bold text-sm tracking-wider">DTB · WebContainer</div>
          <div className="text-[9px] text-neutral-500 -mt-0.5">{project.name} · {project.files?.length || 0} files</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge status={status} />
          {status === 'idle' && (
            <Button size="sm" onClick={startContainer} className="h-8 bg-neutral-900 text-white hover:bg-neutral-800">▶ Start</Button>
          )}
          {(status === 'ready' || status === 'error') && (
            <Button size="sm" variant="outline" onClick={restart} className="h-8 border-neutral-300"><RefreshCw className="h-3.5 w-3.5 mr-1" /> Restart</Button>
          )}
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-8 border-neutral-300"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Open</Button>
            </a>
          )}
        </div>
      </header>

      {isolated === false && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>This page is NOT cross-origin isolated. WebContainers need COOP/COEP headers (set in <code>next.config.js</code>). Restart the dev server or check headers on production.</span>
        </div>
      )}

      <div className="flex-1 grid grid-cols-2 overflow-hidden">
        <div className="border-r border-neutral-200 bg-neutral-950 text-emerald-400 flex flex-col">
          <div className="text-xs px-3 py-1.5 border-b border-neutral-800 bg-neutral-900 text-neutral-300 font-mono flex items-center gap-2">
            <span>● terminal</span>
            {status === 'installing' || status === 'booting' || status === 'mounting' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          </div>
          <ScrollArea className="flex-1">
            <pre className="p-3 text-[11px] font-mono whitespace-pre-wrap leading-relaxed">{log || '$ press ▶ Start to boot the WebContainer'}</pre>
            <div ref={logEndRef} />
          </ScrollArea>
        </div>
        <div className="bg-white flex flex-col">
          <div className="text-xs px-3 py-1.5 border-b border-neutral-200 bg-neutral-50 text-neutral-500 font-mono">
            {previewUrl || 'preview will appear here once the dev server is ready'}
          </div>
          {previewUrl ? (
            <iframe title="WebContainer Preview" src={previewUrl} className="flex-1 w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals" />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <div className="text-5xl mb-3">🚀</div>
                <p className="text-sm text-neutral-500 max-w-sm">
                  {status === 'idle' && 'Click ▶ Start. The first run takes 30-60s (boot + npm install).'}
                  {status === 'booting' && 'Booting WebContainer runtime in your browser...'}
                  {status === 'mounting' && 'Mounting files in the virtual filesystem...'}
                  {status === 'installing' && 'Running npm install — this is the slow part.'}
                  {status === 'running' && 'Starting dev server...'}
                  {status === 'error' && <span className="text-red-600">Error: {error}</span>}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    idle: ['bg-neutral-200 text-neutral-700', 'idle'],
    booting: ['bg-blue-100 text-blue-700', 'booting'],
    mounting: ['bg-blue-100 text-blue-700', 'mounting'],
    installing: ['bg-amber-100 text-amber-700', 'installing'],
    running: ['bg-amber-100 text-amber-700', 'starting server'],
    ready: ['bg-emerald-100 text-emerald-700', '● ready'],
    error: ['bg-red-100 text-red-700', '✗ error'],
  }
  const [cls, label] = map[status] || map.idle
  return <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${cls}`}>{label}</span>
}
