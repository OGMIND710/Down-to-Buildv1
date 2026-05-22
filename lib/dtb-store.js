'use client'

import { v4 as uuidv4 } from 'uuid'

export const STORAGE_KEY = 'dtb_projects_v1'
export const ACTIVE_KEY = 'dtb_active_v1'
export const SETTINGS_KEY = 'dtb_settings_v1'

export const DEFAULT_SYSTEM_PROMPT = `You are DTB ("Down To Build") — an expert React component builder operating under a Cline-inspired agent workflow. Your job is to generate a SINGLE, self-contained React functional component based on the user's request, and to FIX it when given error feedback.

STRICT RULES:
1. Output ONLY JSX/JS code inside a single \`\`\`jsx code block. No prose before/after.
2. The component MUST be named "App" using "function App() { ... }" (no export, no arrow at root).
3. Hooks via React global: const { useState, useEffect, useRef, useMemo } = React;
4. Tailwind CSS classes only. Make it BEAUTIFUL: modern spacing, subtle borders, hover states, smooth transitions.
5. DO NOT import anything. React, ReactDOM, hooks are global.
6. DO NOT use TypeScript.
7. Prefer a neutral grey/white aesthetic with one accent unless the user requests otherwise.
8. If the user provides an ERROR message, return the FULL CORRECTED component (not a diff).`

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
    code: DEFAULT_CODE,
    overrides: {}, // partial override of global settings (per-project)
  }
}

// Fields that can be overridden per project
export const OVERRIDABLE_FIELDS = [
  'mode', 'ollamaUrl', 'ollamaModel', 'provider', 'apiKey', 'apiModel',
  'agentMode', 'maxIterations', 'streaming', 'systemPrompt',
]

// Merge global settings with per-project overrides
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
