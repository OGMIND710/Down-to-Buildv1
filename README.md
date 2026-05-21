# DTB — Down To Build

> A Next.js split-screen workspace inspired by **v0**, **Bolt**, and **Cline** that lets you chat with an LLM (local Ollama or any external API), runs a **Cline-style agent loop** (plan → render → auto-fix), and renders the generated React component live, side by side. Now with **Supabase cross-device sync** and **GitHub push**.

```
       _____ _______ ____
      |  __ \__   __|  _ \
      | |  | | | |  | |_) |   Down
      | |  | | | |  |  _ <    To
      | |__| | | |  | |_) |   Build
      |_____/  |_|  |____/
```

## ✨ Features

- **Split-screen workspace** — chat on the left, live preview / code on the right (resizable).
- **Cline-inspired Agent Mode** — multi-step loop: the agent generates code, renders it inside the iframe, captures any runtime/render error via `postMessage`, and re-prompts the LLM to fix the code until it works (configurable iterations, default 3).
- **Multi-project** with **local-first persistence** (`localStorage`), auto-saved on every change.
- **LLM agnostic** — toggle between:
  - **Ollama (local)** — set Base URL + Model name.
  - **External API** — OpenAI, Anthropic, Groq, OpenRouter with your own key.
- **Supabase sync** — push / pull projects to a `dtb_projects` table for cross-device access.
- **GitHub push** — commit the current component as a `.jsx` file to any repo using a Personal Access Token.
- **Live preview** in a sandboxed iframe via Babel standalone + Tailwind CDN.
- **Tabs** — Preview / Code; copy, download `.jsx`, or push to GitHub from the top of the right pane.
- **Dark grey UI** built with shadcn/ui + Tailwind (neutral palette).

## 🚀 Local installation

### Prerequisites

- Node.js 18+
- Yarn (`npm i -g yarn`)
- *(optional)* [Ollama](https://ollama.com) running locally for free local inference

### Setup

```bash
git clone <your-repo-url>
cd dtb

# Install (always use yarn, not npm)
yarn install

# Create .env
cat > .env <<'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=dtb
NEXT_PUBLIC_BASE_URL=http://localhost:3000
EOF

# Dev
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | What it does |
|---|---|
| `yarn dev` | Start Next.js in dev on port 3000 |
| `yarn build` | Production build |
| `yarn start` | Run the production build |

## 🦙 Using Ollama (free, local, private)

```bash
# Install (macOS/Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Pull a coding model
ollama pull qwen2.5-coder:7b
# or, smaller/faster:
ollama pull llama3.2

# Ollama listens on http://localhost:11434 by default
```

Then in DTB → **Settings → Ollama (Local)**: Base URL `http://localhost:11434`, Model `qwen2.5-coder:7b`.

> Ollama doesn't accept browser CORS requests, so DTB proxies through `/api/llm/chat`. Ollama must be reachable from the same machine running Next.js.

## 🔑 External LLM providers

In **Settings → External API**, choose a provider and paste your key:

| Provider | Key | Default model |
|---|---|---|
| OpenAI | https://platform.openai.com/api-keys | `gpt-4o-mini` |
| Anthropic | https://console.anthropic.com/settings/keys | `claude-3-5-sonnet-20241022` |
| Groq | https://console.groq.com/keys | `llama-3.3-70b-versatile` |
| OpenRouter | https://openrouter.ai/keys | `meta-llama/llama-3.3-70b-instruct:free` |

Keys stay on your device (localStorage) and are sent only server-side via the proxy route.

## ⚡ Cline-style Agent Mode

Toggle **Settings → Cline Agent Mode** (on by default). When enabled, every prompt triggers:

1. LLM call with the strict system prompt (must output one ```jsx block with `function App()`).
2. The code is rendered inside a sandboxed iframe.
3. The iframe reports back via `postMessage`:
   - `__dtb_ok` → done ✅
   - `__dtb_error` → DTB re-prompts the LLM with the error message and asks for a corrected full component.
4. Loop until it renders or `maxIterations` is reached.

You'll see the live agent steps streamed under the loader (Planning… → Rendering… → ✓ or ✗ → Iteration 2 → …).

### Plus: Cline VS Code extension

For a full IDE-level agent workflow, install the real **Cline** extension and point it at your Ollama:

```bash
# 1. Install
code --install-extension saoudrizwan.claude-dev

# 2. Pull a model
ollama pull qwen2.5-coder:7b

# 3. Open Cline panel → ⚙ → API Provider: Ollama
#    Base URL: http://localhost:11434
#    Model:    qwen2.5-coder:7b
```

The **Cline Setup** button in the DTB top-bar shows the same instructions in-app.

Repo: <https://github.com/cline/cline>

## ☁️ Supabase sync (cross-device)

1. Create a free project at <https://supabase.com>.
2. In the SQL editor, run:
   ```sql
   create table dtb_projects (
     id uuid primary key,
     data jsonb not null,
     updated_at timestamptz default now()
   );
   -- For MVP: disable RLS, or add a permissive anon policy
   alter table dtb_projects disable row level security;
   ```
3. In DTB → top-bar **Sync** dialog:
   - Project URL: `https://xxxx.supabase.co`
   - Anon key (from Project Settings → API)
   - Toggle **Enable**, then `Push all ↑` / `Pull ↓`.

Push upserts every project; Pull replaces the local list with the latest from Supabase.

## 🐙 GitHub push

1. Create a Personal Access Token (classic) with **repo** scope at <https://github.com/settings/tokens/new?scopes=repo&description=DTB>.
2. In **Sync** dialog → GitHub section:
   - Token, `username/repo-name`, branch (default `main`).
3. Click **Push** in the top-bar (or in the right pane) to commit the current project's `.jsx` to the repo (uses the GitHub Contents API, creates or updates the file at `<project-name>.jsx`).

## 🗂 Project structure

```
app/
├── app/
│   ├── api/[[...path]]/route.js   # LLM proxy + Supabase + GitHub endpoints
│   ├── layout.js
│   └── page.js                     # Whole split-screen UI + agent loop
├── components/ui/                  # shadcn components
├── lib/
└── package.json
```

## 🛠 API endpoints (proxy)

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/health` | Health check |
| `POST` | `/api/llm/chat` | LLM proxy (Ollama / OpenAI / Anthropic / Groq / OpenRouter) |
| `POST` | `/api/sync/supabase` | `{ action: 'push'\|'pull', url, key, projects }` |
| `POST` | `/api/sync/github` | `{ token, repo, branch, path, content, message }` |

## 🛣 Roadmap

- Streaming responses for live token rendering
- Multi-file projects (the agent can output several components)
- Versioning / undo per project
- Shareable public preview URLs

---

MIT License.
