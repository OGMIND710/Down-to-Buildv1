# BoltClone — AI React Component Builder

A Next.js split-screen workspace inspired by **v0** and **Bolt** that lets you chat with an LLM (local Ollama or any external API) and see the generated React component rendered live, side by side.

## ✨ Features

- **Split-screen workspace** — chat on the left, live preview / code on the right (resizable).
- **Local-first persistence** — projects (chat history, code, LLM config) saved in `localStorage`. Auto-saved on every change.
- **Multi-project** — sidebar with project list, create / rename / delete.
- **LLM agnostic** — toggle between:
  - **Ollama (local)** — set Base URL + Model name.
  - **External API** — choose between OpenAI, Anthropic, Groq, OpenRouter + API key.
- **Live preview** — generated component is rendered in a sandboxed iframe via Babel standalone + Tailwind CDN.
- **Tabs** — switch between Preview and the raw source code; copy or download as `.jsx`.
- **Dark mode UI** — built with shadcn/ui + Tailwind.

## 🚀 Local installation

### Prerequisites

- Node.js 18+
- Yarn (`npm i -g yarn`)
- *(optional)* [Ollama](https://ollama.com) running locally if you want fully local inference.

### Setup

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd <repo-folder>

# 2. Install dependencies (always use yarn, not npm)
yarn install

# 3. Create a .env file at the project root
cat > .env <<'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=boltclone
NEXT_PUBLIC_BASE_URL=http://localhost:3000
EOF

# 4. Run the dev server
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | What it does |
|---|---|
| `yarn dev` | Start Next.js in dev mode on `http://localhost:3000` |
| `yarn build` | Production build |
| `yarn start` | Run the production build |

## 🦙 Using Ollama (local, free, private)

1. Install Ollama: https://ollama.com
2. Pull a model that supports code:
   ```bash
   ollama pull llama3.2
   # or, recommended for coding:
   ollama pull qwen2.5-coder:7b
   ```
3. Start Ollama (it runs as a service on `http://localhost:11434`).
4. In the app, click **Settings → Ollama (Local)** and set:
   - **Base URL**: `http://localhost:11434`
   - **Model**: `llama3.2` (or whichever you pulled)

> Because Ollama doesn't accept browser CORS requests, the app proxies calls through the Next.js route `/api/llm/chat`. This means **Ollama must be reachable from the same machine where Next.js is running**.

## 🔑 Using an External API

In **Settings → External API**, pick a provider and paste your key:

| Provider | Get your key | Default model |
|---|---|---|
| OpenAI | https://platform.openai.com/api-keys | `gpt-4o-mini` |
| Anthropic | https://console.anthropic.com/settings/keys | `claude-3-5-sonnet-20241022` |
| Groq | https://console.groq.com/keys | `llama-3.3-70b-versatile` |
| OpenRouter | https://openrouter.ai/keys | `meta-llama/llama-3.3-70b-instruct:free` |

Keys stay on your device (localStorage) and are only sent server-side via the proxy route.

## 🧠 How it works

1. You type a prompt in the chat.
2. The frontend POSTs `{messages, provider, model, …}` to `/api/llm/chat`.
3. The route injects a strict system prompt that forces the model to reply with **one** `\`\`\`jsx … \`\`\`` block defining a `function App() { … }` using globals `React`, `useState`, etc.
4. The app extracts the code, stores it in the active project, and renders it inside an iframe (`srcdoc`) which loads React + Tailwind from CDNs and runs the code through Babel standalone.
5. The whole project (chat + code + config) is written to `localStorage` automatically.

## 🗂 Project structure

```
app/
├── app/
│   ├── api/[[...path]]/route.js   # LLM proxy (Ollama / OpenAI / Anthropic / Groq / OpenRouter)
│   ├── layout.js
│   └── page.js                    # Whole split-screen UI
├── components/ui/                 # shadcn components
├── lib/
└── package.json
```

## 🛣 Roadmap ideas

- Streaming responses
- Multi-file project output
- Supabase backend for cross-device sync
- Versioning / undo per project
- Sharing public preview URLs

---

MIT License.
