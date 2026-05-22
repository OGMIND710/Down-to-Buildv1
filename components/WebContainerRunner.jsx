'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, RefreshCw, ExternalLink, AlertTriangle, Play, Square } from 'lucide-react'
import { detectWebContainerError } from '@/lib/dtb-store'

// The default port the AI is instructed to use. Hard-coded everywhere so
// the iframe / server-ready handler is deterministic.
export const WC_PORT = 3050

function buildFileTree(files) {
  const tree = {}
  for (const file of files) {
    const segments = file.path.split('/').filter(Boolean)
    let current = tree
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const isLast = i === segments.length - 1
      if (isLast) current[seg] = { file: { contents: file.content } }
      else { if (!current[seg]) current[seg] = { directory: {} }; current = current[seg].directory }
    }
  }
  return tree
}

// Repairs common AI mistakes in package.json so npm run dev finds 'next' and binds to WC_PORT.
function sanitizePackageJson(content) {
  try {
    const pkg = JSON.parse(content)
    pkg.scripts = pkg.scripts || {}
    const ensureNpx = (cmd) => {
      if (!cmd) return cmd
      const trimmed = cmd.trim()
      if (/^npx\s/.test(trimmed)) return trimmed
      // Bare binary at start → wrap in npx --yes
      if (/^(next|vite|nodemon|tsx|ts-node|astro|remix|nuxt|webpack|parcel)(\s|$)/.test(trimmed)) {
        return 'npx --yes ' + trimmed
      }
      return trimmed
    }
    const forcePort = (cmd, port) => {
      if (!cmd) return cmd
      // strip existing -p / --port and append our port
      let c = cmd.replace(/\s+(-p|--port)\s+\d+/g, '').trim()
      // Only inject a port flag if we recognise a server binary that supports it
      if (/(next\s+(dev|start))/.test(c)) c += ` -p ${port}`
      else if (/(vite)/.test(c) && !/--port/.test(c)) c += ` --port ${port}`
      return c
    }
    for (const k of Object.keys(pkg.scripts)) {
      pkg.scripts[k] = forcePort(ensureNpx(pkg.scripts[k]), WC_PORT)
    }
    if (!pkg.scripts.dev) pkg.scripts.dev = `npx --yes next dev -p ${WC_PORT}`
    // Ensure next + react deps exist when dev mentions next
    pkg.dependencies = pkg.dependencies || {}
    if (/next/.test(pkg.scripts.dev)) {
      if (!pkg.dependencies.next) pkg.dependencies.next = '14.2.3'
      if (!pkg.dependencies.react) pkg.dependencies.react = '^18'
      if (!pkg.dependencies['react-dom']) pkg.dependencies['react-dom'] = '^18'
    }
    return JSON.stringify(pkg, null, 2)
  } catch (e) {
    return content
  }
}

export default function WebContainerRunner({ project, compact = false, onLifecycle, runKey }) {
  // runKey is a parent-provided string (e.g. files-hash). Every time it changes
  // we tear down and re-mount, so the auto-fix loop in app/page.js can just
  // patch project.files and bump runKey.
  const [status, setStatus] = useState('idle') // idle | booting | mounting | installing | running | ready | error
  const [previewUrl, setPreviewUrl] = useState(null)
  const [log, setLog] = useState('')
  const [error, setError] = useState(null)
  const [isolated, setIsolated] = useState(null)
  const wcRef = useRef(null)
  const bootedRef = useRef(false)
  const logEndRef = useRef(null)
  const bufferRef = useRef('')
  const lifecycleRef = useRef(onLifecycle)
  lifecycleRef.current = onLifecycle

  useEffect(() => { setIsolated(typeof self !== 'undefined' ? self.crossOriginIsolated : null) }, [])
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [log])

  // Auto-teardown on unmount or project change
  useEffect(() => {
    return () => { try { wcRef.current?.teardown?.() } catch (e) {} }
  }, [project?.id])

  // Auto-restart when runKey changes (auto-fix loop re-mount)
  useEffect(() => {
    if (!runKey) return
    if (status === 'idle') return // nothing booted yet; user clicks Start
    // Re-run silently
    ;(async () => {
      try { await wcRef.current?.teardown?.() } catch (e) {}
      wcRef.current = null; bootedRef.current = false; setPreviewUrl(null)
      setStatus('idle'); setLog(''); bufferRef.current = ''
      setTimeout(() => startContainer(), 50)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey])

  const emit = (evt) => { try { lifecycleRef.current?.(evt) } catch (e) {} }

  const appendLog = (s) => {
    setLog(prev => prev + s)
    bufferRef.current += s
    // Detect fatal errors as they stream in
    const err = detectWebContainerError(s)
    if (err) emit({ type: 'error-detected', message: err, buffer: bufferRef.current.slice(-2000) })
  }

  const startContainer = async () => {
    if (!project || !project.files || project.files.length === 0) return
    if (bootedRef.current) return
    bootedRef.current = true
    setError(null); setStatus('booting'); setLog(''); bufferRef.current = ''
    emit({ type: 'boot-start' })

    try {
      const sanitizedFiles = project.files.map(f =>
        f.path.endsWith('package.json') ? { ...f, content: sanitizePackageJson(f.content) } : f
      )

      appendLog('→ Importing WebContainer API...\n')
      const { WebContainer } = await import('@webcontainer/api')
      appendLog('→ Booting WebContainer (one-time, may take ~10s)...\n')
      const wc = await WebContainer.boot()
      wcRef.current = wc

      setStatus('mounting')
      appendLog(`→ Mounting ${sanitizedFiles.length} files...\n`)
      await wc.mount(buildFileTree(sanitizedFiles))
      for (const f of sanitizedFiles) appendLog(`  ✓ ${f.path}\n`)

      setStatus('installing')
      appendLog('\n→ Running: npm install\n')
      const install = await wc.spawn('npm', ['install'])
      install.output.pipeTo(new WritableStream({ write: (d) => appendLog(d) }))
      const code = await install.exit
      if (code !== 0) {
        emit({ type: 'install-failed', exitCode: code, buffer: bufferRef.current.slice(-2000) })
        throw new Error(`npm install failed (exit ${code})`)
      }
      appendLog('\n✓ Dependencies installed.\n')

      const pkgFile = sanitizedFiles.find(f => f.path === 'package.json')
      let devScript = 'dev'
      try {
        const pkg = JSON.parse(pkgFile.content)
        if (pkg.scripts && !pkg.scripts.dev && pkg.scripts.start) devScript = 'start'
      } catch (e) {}

      setStatus('running')
      appendLog(`\n→ Running: npm run ${devScript}\n`)
      const dev = await wc.spawn('npm', ['run', devScript])
      let fallbackUsed = false
      dev.output.pipeTo(new WritableStream({ write: (d) => {
        appendLog(d)
        if (/command not found/.test(d) && !fallbackUsed) {
          fallbackUsed = true
          appendLog(`\n→ Fallback: trying npx --yes next dev -p ${WC_PORT} directly...\n`)
          wc.spawn('npx', ['--yes', 'next', 'dev', '-p', String(WC_PORT)]).then(p => {
            p.output.pipeTo(new WritableStream({ write: (d2) => appendLog(d2) }))
            p.exit.then(c => {
              if (c !== 0) emit({ type: 'dev-exited', exitCode: c, buffer: bufferRef.current.slice(-2000) })
            })
          })
        }
      } }))
      // If the dev process ever exits with a code, the parent loop should know
      dev.exit.then(c => {
        if (c !== 0) {
          emit({ type: 'dev-exited', exitCode: c, buffer: bufferRef.current.slice(-2000) })
          setStatus(prev => prev === 'ready' ? prev : 'error')
        }
      })

      wc.on('server-ready', (port, url) => {
        appendLog(`\n✓ Server ready at ${url} (port ${port})\n`)
        setPreviewUrl(url); setStatus('ready')
        emit({ type: 'ready', port, url })
      })
    } catch (e) {
      console.error(e)
      setError(e.message || String(e)); setStatus('error')
      appendLog(`\n✗ Error: ${e.message || e}\n`)
      bootedRef.current = false
      emit({ type: 'boot-failed', message: e.message || String(e), buffer: bufferRef.current.slice(-2000) })
    }
  }

  const restart = async () => {
    if (wcRef.current) { try { await wcRef.current.teardown() } catch (e) {} }
    wcRef.current = null; bootedRef.current = false; setPreviewUrl(null)
    setStatus('idle'); setLog(''); bufferRef.current = ''
    setTimeout(startContainer, 100)
  }

  const stop = async () => {
    if (wcRef.current) { try { await wcRef.current.teardown() } catch (e) {} }
    wcRef.current = null; bootedRef.current = false; setPreviewUrl(null)
    setStatus('idle')
  }

  if (!project || !project.files || project.files.length === 0) {
    return <div className="h-full flex items-center justify-center text-sm text-neutral-500 p-8 text-center">No files yet. Generate a multi-file project from the chat.</div>
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-neutral-200 flex items-center gap-2 bg-white text-xs">
        <StatusBadge status={status} />
        <span className="text-[10px] text-neutral-400 font-mono">port {WC_PORT}</span>
        {status === 'idle' && (
          <Button size="sm" onClick={startContainer} className="h-7 text-xs bg-neutral-900 text-white hover:bg-neutral-800">
            <Play className="h-3 w-3 mr-1" /> Start
          </Button>
        )}
        {(status === 'ready' || status === 'error') && (
          <Button size="sm" variant="outline" onClick={restart} className="h-7 text-xs border-neutral-300">
            <RefreshCw className="h-3 w-3 mr-1" /> Restart
          </Button>
        )}
        {(status === 'booting' || status === 'mounting' || status === 'installing' || status === 'running') && (
          <Button size="sm" variant="outline" onClick={stop} className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50">
            <Square className="h-3 w-3 mr-1" /> Stop
          </Button>
        )}
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="ml-auto">
            <Button size="sm" variant="outline" className="h-7 text-xs border-neutral-300">
              <ExternalLink className="h-3 w-3 mr-1" /> Open in new tab
            </Button>
          </a>
        )}
      </div>

      {isolated === false && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-[11px] px-3 py-1.5 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Cross-origin isolation OFF. WebContainers need COOP/COEP. Check headers on this page.</span>
        </div>
      )}

      <div className={`flex-1 grid ${compact ? 'grid-rows-2' : 'grid-cols-2'} overflow-hidden`}>
        {/* Terminal */}
        <div className="bg-neutral-950 text-emerald-400 flex flex-col overflow-hidden border-r border-neutral-200">
          <div className="text-[10px] px-2 py-1 border-b border-neutral-800 bg-neutral-900 text-neutral-300 font-mono flex items-center gap-2">
            <span>● terminal</span>
            {(status === 'installing' || status === 'booting' || status === 'mounting' || status === 'running') && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
          </div>
          <ScrollArea className="flex-1">
            <pre className="p-2 text-[10px] font-mono whitespace-pre-wrap leading-snug">{log || '$ press ▶ Start to boot the WebContainer'}</pre>
            <div ref={logEndRef} />
          </ScrollArea>
        </div>
        {/* Preview iframe */}
        <div className="bg-white flex flex-col overflow-hidden">
          <div className="text-[10px] px-2 py-1 border-b border-neutral-200 bg-neutral-50 text-neutral-500 font-mono truncate">
            {previewUrl || `preview will appear here once the dev server is ready on port ${WC_PORT}`}
          </div>
          {previewUrl ? (
            <iframe title="WebContainer Preview" src={previewUrl} className="flex-1 w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals" />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-4">
              <div>
                <div className="text-3xl mb-2">🚀</div>
                <p className="text-[11px] text-neutral-500 max-w-xs">
                  {status === 'idle' && 'Click ▶ Start. First run: 30-60s (boot + npm install).'}
                  {status === 'booting' && 'Booting WebContainer runtime...'}
                  {status === 'mounting' && 'Mounting files in the virtual FS...'}
                  {status === 'installing' && 'Running npm install...'}
                  {status === 'running' && 'Starting dev server...'}
                  {status === 'error' && <span className="text-red-600">{error}</span>}
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
    running: ['bg-amber-100 text-amber-700', 'starting'],
    ready: ['bg-emerald-100 text-emerald-700', '● ready'],
    error: ['bg-red-100 text-red-700', '✗ error'],
  }
  const [cls, label] = map[status] || map.idle
  return <span className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${cls}`}>{label}</span>
}
