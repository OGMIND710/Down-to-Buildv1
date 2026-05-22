'use client'

import { v4 as uuidv4 } from 'uuid'

export const STORAGE_KEY = 'dtb_projects_v1'
export const ACTIVE_KEY = 'dtb_active_v1'
export const SETTINGS_KEY = 'dtb_settings_v1'

// Output modes - shape what the AI emits and what DTB does with it
export const OUTPUT_MODES = [
  { id: 'component', label: 'Single Component', desc: 'One React component, instant iframe preview' },
  { id: 'webcontainer', label: 'Fullstack (WebContainer)', desc: 'Multi-file Next.js/Express app, runs in browser via WebContainers' },
  { id: 'local', label: 'Fullstack (Local)', desc: 'Multi-file project, download ZIP or push to GitHub' },
  { id: 'supabase', label: 'Component + Supabase BaaS', desc: 'React component + Supabase SQL schema for backend' },
]

// System prompts per mode
const COMPONENT_PROMPT = `You are DTB ("Down To Build"). Generate ONE self-contained React component.

RULES:
1. Output ONLY a single \`\`\`jsx code block. No prose.
2. Component must be named "App": function App() { ... }
3. Use React via globals: const { useState, useEffect, useRef } = React;
4. Tailwind CSS classes only. Modern, beautiful, grey/white aesthetic.
5. NO imports. NO TypeScript.
6. If user gives an ERROR, return the FULL corrected component.`

const MULTIFILE_PROMPT = `You are DTB ("Down To Build"). Generate a complete multi-file Next.js or Express project.

OUTPUT FORMAT — STRICT:
For each file emit a fenced block:

\`\`\`file:path/to/filename.ext
<file contents here>
\`\`\`

ALWAYS include a working "package.json" with a "dev" script. Prefer:
- Next.js 14 App Router for frontend+API: { "dev": "next dev -p 3000" }
- Or simple Express: { "dev": "node server.js" }

RULES:
1. Output ONLY file blocks. No prose before/after.
2. Use ONLY public npm packages. No private registries.
3. Keep dependencies minimal (next, react, react-dom for Next.js; express for Express).
4. For Next.js: include app/page.js (or pages/index.js), app/layout.js, package.json.
5. For Express: include server.js, package.json. Listen on process.env.PORT || 3000.
6. NO secrets, NO API keys hardcoded.
7. JavaScript only (no TypeScript) unless the user asks otherwise.
8. Make the UI beautiful with Tailwind via CDN if Next.js (\\<script src="https://cdn.tailwindcss.com"\\>) or inline styles for Express.
9. If user gives an ERROR, return ALL files (not a diff) with the fix.

Example minimal Next.js output:

\`\`\`file:package.json
{
  "name": "dtb-app",
  "version": "0.1.0",
  "private": true,
  "scripts": { "dev": "next dev -p 3000" },
  "dependencies": { "next": "14.2.3", "react": "^18", "react-dom": "^18" }
}
\`\`\`

\`\`\`file:app/layout.js
export default function RootLayout({ children }) {
  return (<html><head><script src="https://cdn.tailwindcss.com"></script></head><body>{children}</body></html>);
}
\`\`\`

\`\`\`file:app/page.js
export default function Page() {
  return <main className="min-h-screen flex items-center justify-center bg-neutral-100"><h1 className="text-4xl font-bold">Hello DTB</h1></main>;
}
\`\`\``

const SUPABASE_PROMPT = `You are DTB ("Down To Build"). Generate a React component PLUS Supabase SQL schema.

OUTPUT FORMAT — STRICT, in this order:

1. ONE \`\`\`sql block with the schema (CREATE TABLE, RLS policies, etc.).
2. ONE \`\`\`jsx block defining function App() { ... }.

The component must use the global "supabase" object (already initialized) to read/write data, e.g.:
  const { data } = await supabase.from('todos').select('*');
  await supabase.from('todos').insert({ text: 'x' });

RULES:
1. Use React via globals: const { useState, useEffect } = React;
2. Tailwind CSS classes only. Modern grey/white aesthetic.
3. SQL: enable RLS but add a permissive anon policy for MVP.
4. NO imports. NO TypeScript.
5. The component handles its own loading/error states.
6. If user gives an ERROR, return the corrected SQL + component (both blocks).`

export function getSystemPrompt(mode, custom) {
  if (custom && custom !== DEFAULT_SYSTEM_PROMPT) return custom
  if (mode === 'webcontainer' || mode === 'local') return MULTIFILE_PROMPT
  if (mode === 'supabase') return SUPABASE_PROMPT
  return COMPONENT_PROMPT
}

export const DEFAULT_SYSTEM_PROMPT = COMPONENT_PROMPT

export const DEFAULT_SETTINGS = {
  mode: 'ollama',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2',
  provider: 'openai',
  apiKey: '',
  apiModel: '',
  agentMode: true,
  maxIterations: 3,
  streaming: true,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  outputMode: 'component',
  // Cloud
  supabaseUrl: '',
  supabaseKey: '',
  supabaseEnabled: false,
  // Git
  githubToken: '',
  githubUser: '',
  githubRepo: '',
  githubBranch: 'main',
}

const DEFAULT_CODE = `function App() {
  const { useState } = React;
  const [name, setName] = useState('builder');
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-200 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🔨</div>
        <h1 className="text-5xl font-bold text-neutral-900 mb-3 tracking-tight">
          Down To Build, {name}?
        </h1>
        <p className="text-neutral-600 mb-6">Describe what you want to build in the chat →</p>
        <input value={name} onChange={(e) => setName(e.target.value)} className="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-neutral-900 text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400" />
      </div>
    </div>
  );
}`
export { DEFAULT_CODE }

export function newProject() {
  return {
    id: uuidv4(),
    name: 'Untitled Project',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    code: DEFAULT_CODE,    // single-component code (mode=component or supabase)
    files: [],             // [{ path, content }] for multi-file modes
    sql: '',               // supabase schema if mode=supabase
    overrides: {},
  }
}

export const OVERRIDABLE_FIELDS = [
  'mode', 'ollamaUrl', 'ollamaModel', 'provider', 'apiKey', 'apiModel',
  'agentMode', 'maxIterations', 'streaming', 'systemPrompt', 'outputMode',
]

export function effectiveSettings(globalSettings, project) {
  const overrides = project?.overrides || {}
  return { ...globalSettings, ...overrides }
}

export function loadSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch (e) { return DEFAULT_SETTINGS }
}
export function saveSettings(s) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

// ===== PARSERS =====
// Single component: extract first ```jsx block
export function extractComponent(text) {
  const m = text.match(/```(?:jsx|js|javascript|tsx)?\n?([\s\S]*?)```/)
  return m ? m[1].trim() : null
}

// Multi-file: extract ```file:path\n...``` blocks
export function extractFiles(text) {
  const files = []
  const re = /```file:([^\n`]+)\n([\s\S]*?)```/g
  let m
  while ((m = re.exec(text)) !== null) {
    files.push({ path: m[1].trim(), content: m[2] })
  }
  return files
}

// Supabase: { sql, jsx }
export function extractSupabase(text) {
  const sqlM = text.match(/```sql\n?([\s\S]*?)```/)
  const jsxM = text.match(/```(?:jsx|js|javascript|tsx)\n?([\s\S]*?)```/)
  return { sql: sqlM ? sqlM[1].trim() : null, jsx: jsxM ? jsxM[1].trim() : null }
}
