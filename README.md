# DTB — Down To Build

> A Next.js split-screen workspace inspired by **v0**, **Bolt**, and **Cline** that lets you chat with an LLM (local Ollama or any external API), runs a **Cline-style agent loop** (plan → render → auto-fix), streams tokens live, and renders the generated React component side by side. Comes with **Supabase cross-device sync**, **GitHub push**, **global + per-project settings**, and instructions to ship a desktop **.exe / .app / .AppImage**.

```
       _____ _______ ____
      |  __ \__   __|  _ \
      | |  | | | |  | |_) |   Down
      | |  | | | |  |  _ <    To
      | |__| | | |  | |_) |   Build
      |_____/  |_|  |____/
```

---

## Table of contents

1. [Features](#-features)
2. [Quick start](#-quick-start)
3. [Install on macOS](#-install-on-macos)
4. [Install on Linux](#-install-on-linux)
5. [Install MongoDB (optional)](#-install-mongodb-optional)
6. [Using Ollama (local)](#-using-ollama-local)
7. [External LLM providers](#-external-llm-providers)
8. [Cline integration](#-cline-integration)
9. [Cloud sync — Supabase](#-cloud-sync--supabase)
10. [Git sync — GitHub](#-git-sync--github)
11. [Global vs per-project settings](#-global-vs-per-project-settings)
12. [Build as a desktop app (.exe / .dmg / .AppImage)](#-build-as-a-desktop-app-exe--dmg--appimage)
13. [API endpoints](#-api-endpoints)
14. [Project structure](#-project-structure)

---

## ✨ Features

- **Split-screen workspace** — chat on the left, live preview / code on the right (resizable).
- **Four output modes** (switchable per global setting OR per project):
  - **Single Component** — one React component rendered live in a sandboxed iframe (Babel standalone + Tailwind CDN).
  - **Fullstack (WebContainer)** — multi-file Next.js / Express project that runs **entirely in your browser** via [StackBlitz WebContainers](https://webcontainers.io). `npm install` + dev server inside a virtualized Node.js. No backend infra needed. Free for personal / non-commercial use.
  - **Fullstack (Local)** — multi-file project you download as ZIP or push to a GitHub repo, then run locally with `yarn dev`.
  - **Component + Supabase BaaS** — React component **plus** a SQL schema. The AI generates `CREATE TABLE` statements; one click copies the SQL and opens your Supabase SQL Editor.
- **Cline-inspired Agent Mode** — for single-component modes: generates code, renders it, captures errors via `postMessage`, re-prompts to fix, loops until success or max iterations.
- **Token-by-token streaming** — Ollama (NDJSON), OpenAI / Groq / OpenRouter (SSE), Anthropic (SSE). Cursor blinks live; **Stop** button to abort.
- **Multi-project** with local-first persistence (`localStorage`), auto-saved.
- **LLM agnostic** — Ollama, OpenAI, Anthropic, Groq, OpenRouter.
- **Dedicated `/settings` page** — 5 sections (LLM & Agent · Ollama · Supabase · GitHub · System Prompt) with "Log in / Test" buttons.
- **Global + per-project overrides** — settings page sets defaults; the slider icon next to a project name opens a dialog to override any field (including `outputMode`).
- **Supabase cross-device sync** — push/pull projects to a `dtb_projects` table.
- **GitHub push** — commit the current component as `.jsx` OR push all files of a multi-file project to any repo.
- **Modern grey/white UI** built with shadcn/ui + Tailwind.

---

## 🚀 Quick start

### ⚡ Option A — one-click installers (recommended)

| OS | Command |
|---|---|
| **Windows** | Right-click `install.bat` → **Run as administrator** |
| **macOS / Linux** | `chmod +x install.sh && ./install.sh` |

These scripts will:
1. Detect / install **Node.js LTS** (via winget on Windows, Homebrew on macOS, apt/dnf/pacman on Linux).
2. Install **Yarn** globally.
3. Install **Git** if missing.
4. Install and start **MongoDB Community 7.0** (service / launchd / systemd).
5. Install **Ollama** and optionally pull `qwen2.5-coder:7b`.
6. Create `.env` with default DTB values.
7. Run `yarn install`.
8. Offer to start `yarn dev` and open the browser.

Run from the DTB project root (where `package.json` lives).

### Option B — manual

```bash
git clone <your-repo-url> dtb
cd dtb
yarn install                       # always yarn — never npm
cp .env.example .env || true       # ensure .env exists with the keys below
yarn dev                           # http://localhost:3000
```

`.env`:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=dtb
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

Scripts:

| Command | Purpose |
|---|---|
| `yarn dev` | Next.js dev server on port 3000 |
| `yarn build` | Production build |
| `yarn start` | Run production build |
| `yarn lint` | ESLint |

> **DTB does not require MongoDB** to run — projects are saved in `localStorage` and (optionally) Supabase. MongoDB is wired only because the template ships with it; you can ignore the `MONGO_URL` if you don't need it.

---

## 🍎 Install on macOS

### 1. Install Node.js (via Homebrew)

```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node 18+ and Yarn
brew install node@20
brew install yarn
node -v   # should be ≥ 18
yarn -v
```

### 2. Clone & run

```bash
git clone <your-repo-url> ~/dtb
cd ~/dtb
yarn install
yarn dev
```

Open <http://localhost:3000>.

### 3. (Optional) Install Ollama on macOS

```bash
brew install ollama          # or download from https://ollama.com
brew services start ollama   # auto-starts on http://localhost:11434
ollama pull qwen2.5-coder:7b
```

In DTB → **/settings → Ollama** → Base URL `http://localhost:11434` → Model `qwen2.5-coder:7b` → click 🔄 to refresh the model list.

### 4. (Optional) Tailwind / build issues on Apple Silicon

If you hit `node-gyp` errors on M1/M2:

```bash
xcode-select --install
yarn config set ignore-engines true
yarn install --force
```

---

## 🐧 Install on Linux

### Debian / Ubuntu

```bash
# Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Yarn
sudo npm install -g yarn

# Clone & run
git clone <your-repo-url> ~/dtb
cd ~/dtb
yarn install
yarn dev
```

### Fedora / RHEL

```bash
sudo dnf module install nodejs:20/common
sudo npm install -g yarn
git clone <your-repo-url> ~/dtb && cd ~/dtb && yarn install && yarn dev
```

### Arch / Manjaro

```bash
sudo pacman -S nodejs npm yarn git
git clone <your-repo-url> ~/dtb && cd ~/dtb && yarn install && yarn dev
```

### (Optional) Install Ollama on Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
ollama pull qwen2.5-coder:7b
```

### Run DTB as a systemd service (production)

`/etc/systemd/system/dtb.service`:

```ini
[Unit]
Description=DTB - Down To Build
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/dtb
Environment=NODE_ENV=production
ExecStart=/usr/bin/yarn start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
cd ~/dtb && yarn build
sudo systemctl enable --now dtb
sudo systemctl status dtb
```

---

## 🍃 Install MongoDB (optional)

DTB doesn't *need* MongoDB (it's local-first via `localStorage` + Supabase). Install only if you plan to extend the backend.

### macOS

```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0

# Verify
mongosh --eval "db.runCommand({ ping: 1 })"
```

Connection string: `mongodb://localhost:27017` (put in `.env` as `MONGO_URL`).

### Ubuntu / Debian

```bash
# Import MongoDB public key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Repo
echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt-get update
sudo apt-get install -y mongodb-org

# Start
sudo systemctl enable --now mongod
mongosh --eval "db.runCommand({ ping: 1 })"
```

### Fedora / RHEL

```bash
sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo <<EOF
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF

sudo dnf install -y mongodb-org
sudo systemctl enable --now mongod
```

### Windows

1. Download MSI installer: <https://www.mongodb.com/try/download/community>
2. Choose "Complete" and check **Install MongoDB as a service**.
3. Verify in PowerShell: `mongosh --eval "db.runCommand({ ping: 1 })"`
4. Connection: `mongodb://localhost:27017`.

### Docker (any OS)

```bash
docker run -d --name dtb-mongo -p 27017:27017 \
  -v dtb-mongo-data:/data/db \
  mongo:7
```

Update `.env`:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=dtb
```

---

## 🦙 Using Ollama (local)

```bash
# Install
curl -fsSL https://ollama.com/install.sh | sh         # macOS / Linux
# or download installer from https://ollama.com (Windows)

# Pull a model
ollama pull qwen2.5-coder:7b      # best for coding
ollama pull llama3.2              # smaller / faster
ollama pull deepseek-coder-v2

# Ollama auto-listens on http://localhost:11434
```

In DTB → **/settings → Ollama**:
- Base URL: `http://localhost:11434`
- Model: pick from the auto-detected list (click 🔄)

> Ollama doesn't accept browser CORS requests, so DTB proxies through `/api/llm/chat`. Ollama must be reachable from the same machine running Next.js.

---

## 🔑 External LLM providers

In **/settings → LLM & Agent → External API**:

| Provider | Key | Default model |
|---|---|---|
| OpenAI | <https://platform.openai.com/api-keys> | `gpt-4o-mini` |
| Anthropic | <https://console.anthropic.com/settings/keys> | `claude-3-5-sonnet-20241022` |
| Groq | <https://console.groq.com/keys> | `llama-3.3-70b-versatile` |
| OpenRouter | <https://openrouter.ai/keys> | `meta-llama/llama-3.3-70b-instruct:free` |

Keys are stored in `localStorage`; only the proxy route ever sees them server-side.

---

## ⚡ Cline integration

DTB integrates Cline in **two ways**:

### A) In-app Cline-style agent loop (default, on)

Toggle `/settings → Cline Agent Mode`. On each prompt:

1. The LLM is called with your system prompt (must output one ```jsx block with `function App()`).
2. Code is rendered inside a sandboxed iframe.
3. The iframe reports back via `postMessage`:
   - `__dtb_ok` → ✅ done.
   - `__dtb_error` → DTB re-prompts the LLM with the captured error message, asks for a corrected full component.
4. Loop until success or `maxIterations` is hit (configurable 1–5).

You see the live steps streamed under the chat: *Generating… → Rendering attempt 1 → ✗ TypeError → Iteration 2 → ✓ Render succeeded*.

### B) Real Cline VS Code extension wired to local Ollama

```bash
# Install the extension
code --install-extension saoudrizwan.claude-dev

# Install / start Ollama (see section above)
ollama pull qwen2.5-coder:7b
```

Open the Cline panel in VS Code → ⚙ → API Provider: **Ollama** → Base URL `http://localhost:11434` → Model `qwen2.5-coder:7b`. Cline will then plan, edit files, and run terminal commands autonomously using your local model.

Repo: <https://github.com/cline/cline>

---

## ☁️ Cloud sync — Supabase

1. Create a free project at <https://supabase.com>.
2. SQL editor → run:

   ```sql
   create table dtb_projects (
     id uuid primary key,
     data jsonb not null,
     updated_at timestamptz default now()
   );
   -- For MVP: disable RLS, or add a permissive anon policy
   alter table dtb_projects disable row level security;
   ```
3. In DTB → `/settings → Supabase`:
   - Project URL: `https://xxxx.supabase.co`
   - Anon key (Project Settings → API).
   - Click **Log in / Test** to validate credentials.
   - **Push all ↑** to upload your local projects; **Pull ↓** to download.

---

## 🐙 Git sync — GitHub

1. Create a Personal Access Token (classic) with **repo** scope:
   <https://github.com/settings/tokens/new?scopes=repo&description=DTB>
2. In DTB → `/settings → GitHub`:
   - Paste the token, click **Log in with token** — DTB calls `GET /user` to validate and shows your `@username`.
   - Set default repo (`username/repo-name`) and branch.
3. From the top-bar or right pane, click **Push** to commit the current project as `<name>.jsx` to that repo via the GitHub Contents API.

---

## 🎚 Global vs per-project settings

- **Global settings** live in `/settings` and are saved under `localStorage.dtb_settings_v1`.
- **Per-project overrides**: in the workspace, click the slider icon next to the project name. Each field has an `override` link → when clicked, the value is stored in `project.overrides[field]` and a purple **Overridden** badge appears. Click `inherit` to remove the override and fall back to global.
- The effective value used at runtime is computed as: `{...global, ...project.overrides}`.
- Overridable fields: `mode`, `ollamaUrl`, `ollamaModel`, `provider`, `apiKey`, `apiModel`, `agentMode`, `maxIterations`, `streaming`, `systemPrompt`.

---

## 🖥 Build as a desktop app (.exe / .dmg / .AppImage)

DTB is a Next.js app; you can wrap it with **Electron** and produce installers for Windows, macOS, and Linux using **electron-builder**.

### 1. Add Electron to the project

```bash
yarn add -D electron electron-builder concurrently wait-on cross-env
```

### 2. `electron/main.js`

```js
// electron/main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
let nextServer;

function startNext() {
  if (isDev) return; // `yarn dev` already running in dev
  // In production we start the standalone Next.js server.
  nextServer = spawn(process.execPath, [path.join(__dirname, '..', '.next', 'standalone', 'server.js')], {
    env: { ...process.env, PORT: '3000', NODE_ENV: 'production' },
    stdio: 'inherit',
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900, autoHideMenuBar: true, backgroundColor: '#0a0a0a',
  });
  const url = 'http://localhost:3000';
  win.loadURL(url);
}

app.whenReady().then(async () => {
  startNext();
  // wait a moment for Next to listen
  setTimeout(createWindow, 1500);
});

app.on('window-all-closed', () => {
  if (nextServer) nextServer.kill();
  if (process.platform !== 'darwin') app.quit();
});
```

### 3. Configure `next.config.js` for standalone output

```js
// next.config.js
module.exports = {
  output: 'standalone',
};
```

### 4. `package.json` additions

```json
{
  "main": "electron/main.js",
  "scripts": {
    "electron:dev": "concurrently \"yarn dev\" \"wait-on http://localhost:3000 && electron .\"",
    "electron:build": "yarn build && electron-builder"
  },
  "build": {
    "appId": "com.dtb.app",
    "productName": "DTB",
    "files": [
      "electron/**",
      ".next/standalone/**",
      ".next/static/**",
      "public/**",
      "package.json"
    ],
    "directories": { "output": "dist-electron" },
    "win": { "target": ["nsis", "portable"], "icon": "build/icon.ico" },
    "mac": { "target": ["dmg", "zip"], "icon": "build/icon.icns", "category": "public.app-category.developer-tools" },
    "linux": { "target": ["AppImage", "deb"], "icon": "build/icon.png", "category": "Development" },
    "nsis": { "oneClick": false, "allowToChangeInstallationDirectory": true }
  }
}
```

### 5. Add icons

Create these in `build/`:

```
build/icon.ico    # Windows  (256x256 multi-resolution .ico)
build/icon.icns   # macOS    (use `iconutil` from a .iconset folder)
build/icon.png    # Linux    (512x512 PNG)
```

Quick icon set with ImageMagick + iconutil:

```bash
magick convert dtb-logo.png -resize 256x256 build/icon.ico
magick convert dtb-logo.png -resize 512x512 build/icon.png
# macOS: see https://www.electron.build/icons for iconset → icns
```

### 6. Build the installers

```bash
# Test in dev (hot reload + Electron)
yarn electron:dev

# Ship installers
yarn electron:build
```

Outputs go to `dist-electron/`:
- **Windows** → `DTB Setup x.x.x.exe` (NSIS installer) and `DTB-portable.exe`
- **macOS** → `DTB-x.x.x.dmg` and `.zip`
- **Linux** → `DTB-x.x.x.AppImage` and `.deb`

### 7. Cross-compile from one machine

| Host | Can build for |
|---|---|
| macOS | Windows (with Wine), Linux, macOS |
| Linux | Linux, Windows (with Wine) |
| Windows | Windows, Linux |

```bash
# On macOS, also build Windows installers:
brew install --cask wine-stable
yarn electron:build --win --linux --mac
```

### 8. Notes & gotchas

- **Standalone Next.js**: `output: 'standalone'` produces a self-contained `.next/standalone/server.js` that Electron's main process spawns. Make sure `.next/static/` and `public/` are included in `build.files`.
- **Code signing** (recommended): Windows needs an `.pfx`/`.p12`; macOS needs Apple Developer ID + notarization. See <https://www.electron.build/code-signing>.
- **Auto-updates**: add `electron-updater` and configure a publish target (GitHub Releases / S3) in the `build` block.
- **Bundle Ollama?** Don't. Direct users to install it separately — embedding it would inflate the installer by ~4 GB.

---

## 🛠 API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/health` | Health check |
| `POST` | `/api/llm/chat` | LLM proxy (non-streaming) |
| `POST` | `/api/llm/stream` | LLM proxy with token streaming |
| `POST` | `/api/ollama/models` | List local Ollama models |
| `POST` | `/api/sync/supabase` | `{ action: 'test'\|'push'\|'pull', url, key, projects }` |
| `POST` | `/api/sync/github` | Push a file (or one of many) to a repo |
| `POST` | `/api/sync/github/user` | Validate PAT, return user info |

## 🚀 Output modes — deep dive

DTB has **4 output modes** the AI is instructed to follow. Switch in `/settings → LLM & Agent → Output mode`, or override per-project from the workspace.

### 1. Single Component (default)

The AI returns one \`\`\`jsx block defining `function App()`. DTB renders it instantly in an iframe with React + Tailwind from CDN. Agent mode auto-fixes runtime errors.

### 2. Fullstack (WebContainer)

The AI returns multi-file blocks of the form:

\`\`\`
\`\`\`file:package.json
{ ... }
\`\`\`
\`\`\`file:app/page.js
export default function Page() { ... }
\`\`\`
\`\`\`

DTB shows a file explorer in the right pane. Click **▶ Run in browser** to open `/run/[projectId]`, which:

1. Boots a WebContainer (StackBlitz's Node.js WASM runtime).
2. Mounts all files into the virtual filesystem.
3. Runs `npm install` (terminal output streamed live).
4. Runs `npm run dev` and grabs the preview URL from the `server-ready` event.
5. Loads the resulting URL into a sandboxed iframe — a full Next.js or Express dev server running in your browser.

**Requirements**:
- A Chromium-based browser (Chrome, Edge, Brave, Arc). Safari 16.4+ and Firefox have beta support.
- The `/run/*` route is served with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (already configured in `next.config.js`).
- For production, the host must be HTTPS (localhost is exempt).

**Licensing**: WebContainers are **free for personal & non-commercial / proof-of-concept use**. A commercial license is required only for revenue-generating production deployments. See <https://webcontainers.io/enterprise>.

### 3. Fullstack (Local)

Same multi-file output as mode 2, but DTB does **not** run it in the browser. Instead the right pane exposes:
- **ZIP** — bundle all files (via JSZip) into `your-project.zip` for local extraction.
- **Push all** — commit every file to the configured GitHub repo via the Contents API (uses your PAT).

Then locally:

```bash
unzip your-project.zip && cd your-project
yarn install   # or npm install / pnpm install
yarn dev
```

### 4. Component + Supabase BaaS

The AI returns **two** blocks:
1. \`\`\`sql — the schema (`CREATE TABLE`, RLS policies, etc.).
2. \`\`\`jsx — a React component that uses a global `supabase` object to read/write data.

The right pane gets an extra **🗄 SQL** tab. Click **Apply to Supabase →** to copy the SQL to clipboard and open `your-project.supabase.co/project/_/sql/new` (Supabase's REST API doesn't allow arbitrary DDL with anon keys; you paste & run manually).

> Future: a service-role variant would let DTB run the SQL automatically via the Supabase Management API.

---

## 🗂 Project structure

```
app/
├── app/
│   ├── api/[[...path]]/route.js    # LLM stream + sync endpoints
│   ├── settings/page.js            # Dedicated settings page
│   ├── layout.js
│   └── page.js                     # Workspace (chat + preview + per-project overrides)
├── lib/
│   └── dtb-store.js                # Shared store: defaults, settings, effectiveSettings()
├── components/ui/                  # shadcn components
├── electron/main.js                # (optional) Electron entry
└── package.json
```

---

MIT License.
