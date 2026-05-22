# DTB — Manual installation guide

This is the **step-by-step manual installation** for users who prefer not to run the automated installer (`install.bat` / `install.sh`), or who need to troubleshoot it.

> **TL;DR Windows**: install Node 20 LTS → Git → MongoDB Community → Ollama → VS Code (+ Cline ext) → unzip DTB → `yarn install` → `yarn dev` → http://localhost:3000

---

## 0. Prerequisites — what you need

| Tool | Required? | Why |
|---|---|---|
| **Node.js 20 LTS** | ✅ yes | Runs Next.js |
| **Yarn 1.22+** | ✅ yes | Package manager (DTB does not support npm) |
| **Git** | ✅ yes (or use ZIP download) | Clone the repo |
| **MongoDB 7.0** | ⚠️ optional | Only if you extend the backend; DTB works without it |
| **Ollama** | ⚠️ optional | Free local LLM. Skip if you only use external API keys |
| **VS Code + Cline** | ⚠️ optional | For the IDE-level agent workflow |

---

## 1. Install on Windows (step-by-step)

### 1.1 Install Node.js 20 LTS

**Option A — winget (recommended)**:
```powershell
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
```

**Option B — installer**:
1. Download from <https://nodejs.org/en/download> → choose "LTS"
2. Run `.msi`, accept defaults (especially "Add to PATH")
3. **Reopen** PowerShell (PATH is reloaded only in new shells)
4. Verify:
   ```powershell
   node -v   # should print v20.x or higher
   npm -v
   ```

### 1.2 Install Yarn

```powershell
npm install -g yarn
yarn -v       # should print 1.22.x
```

### 1.3 Install Git (skip if you'll download the ZIP)

```powershell
winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
```

Verify in a new shell:
```powershell
git --version
```

### 1.4 Install MongoDB Community 7.0 (optional)

```powershell
winget install --id MongoDB.Server -e --accept-package-agreements --accept-source-agreements
```

Or download the MSI from <https://www.mongodb.com/try/download/community>. During setup, **check** "Install MongoDB as a Service" — it'll auto-start on boot.

Verify the service:
```powershell
sc query MongoDB
# Look for STATE : 4 RUNNING
```

If not running:
```powershell
net start MongoDB
```

### 1.5 Install Ollama (optional, for local LLM)

```powershell
winget install --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements
```

Or download the installer from <https://ollama.com/download/OllamaSetup.exe> and run it.

After install:
```powershell
ollama serve              # starts the daemon (also auto-started on Windows)
ollama pull qwen2.5-coder:7b
```

Verify:
```powershell
curl http://localhost:11434/api/tags
```

### 1.6 Install VS Code + Cline extension (optional)

```powershell
winget install --id Microsoft.VisualStudioCode -e --accept-package-agreements --accept-source-agreements
# reopen shell so 'code' is in PATH
code --install-extension saoudrizwan.claude-dev
```

Then in VS Code: open the Cline panel → gear icon → API Provider: **Ollama** → Base URL `http://localhost:11434` → Model `qwen2.5-coder:7b`.

### 1.7 Get the DTB source

**Option A — clone with Git**:
```powershell
cd C:\
git clone https://github.com/<your-username>/dtb.git
cd dtb
```

**Option B — download ZIP**:
1. Download the ZIP from your source
2. Extract to e.g. `C:\dtb\`
3. Open PowerShell, `cd C:\dtb`

> ⚠️ Avoid paths with parentheses or spaces (e.g. `C:\Down-to-Build (1)\…`). Some Node.js modules trip up on those. Rename the folder to `C:\dtb\` if needed.

### 1.8 Create `.env`

In the DTB project root, create a file `.env` with:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=dtb
NEXT_PUBLIC_BASE_URL=http://localhost:3000
CORS_ORIGINS=*
```

From PowerShell:
```powershell
@"
MONGO_URL=mongodb://localhost:27017
DB_NAME=dtb
NEXT_PUBLIC_BASE_URL=http://localhost:3000
CORS_ORIGINS=*
"@ | Out-File -FilePath .env -Encoding ASCII
```

### 1.9 Install JS dependencies

```powershell
yarn install
```

Expected duration: 1–3 minutes depending on network speed.

### 1.10 Start the dev server

```powershell
yarn dev
```

You should see:
```
▲ Next.js 14.2.3
- Local:        http://localhost:3000
- Network:      http://0.0.0.0:3000
```

Open <http://localhost:3000> in **Chrome / Edge / Brave** (WebContainer mode needs Chromium).

---

## 2. Install on macOS (step-by-step)

```bash
# 1. Homebrew (if not present)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Node 20 + Yarn + Git
brew install node@20 yarn git
brew link --overwrite --force node@20

# 3. (Optional) MongoDB
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0

# 4. (Optional) Ollama
brew install ollama
brew services start ollama
ollama pull qwen2.5-coder:7b

# 5. (Optional) VS Code + Cline
brew install --cask visual-studio-code
code --install-extension saoudrizwan.claude-dev

# 6. Clone + setup
git clone https://github.com/<you>/dtb.git
cd dtb
cat > .env <<'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=dtb
NEXT_PUBLIC_BASE_URL=http://localhost:3000
CORS_ORIGINS=*
EOF
yarn install
yarn dev
```

---

## 3. Install on Linux (Debian / Ubuntu)

```bash
# Node 20 from NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Yarn
sudo npm install -g yarn

# MongoDB 7.0 (optional)
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update && sudo apt-get install -y mongodb-org
sudo systemctl enable --now mongod

# Ollama (optional)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5-coder:7b

# VS Code + Cline (optional)
sudo apt-get install -y wget gpg
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg
sudo install -D -o root -g root -m 644 microsoft.gpg /etc/apt/keyrings/microsoft.gpg
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/microsoft.gpg] https://packages.microsoft.com/repos/code stable main" | sudo tee /etc/apt/sources.list.d/vscode.list
sudo apt-get update && sudo apt-get install -y code
code --install-extension saoudrizwan.claude-dev

# Clone + setup
git clone https://github.com/<you>/dtb.git
cd dtb
cat > .env <<'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=dtb
NEXT_PUBLIC_BASE_URL=http://localhost:3000
CORS_ORIGINS=*
EOF
yarn install
yarn dev
```

---

## 4. Configure DTB at first launch

1. Open <http://localhost:3000>
2. Click **Settings** (top-right) → `/settings`
3. **LLM & Agent** → choose:
   - **Ollama (Local)** if you installed Ollama → Base URL `http://localhost:11434` + Model (click 🔄 to list installed models)
   - **External API** for cloud LLMs → paste your key (OpenAI / Anthropic / Groq / OpenRouter)
4. **Output mode** → pick the default: Single Component / Fullstack (WebContainer) / Fullstack (Local) / Component + Supabase BaaS
5. *(Optional)* **Supabase** → URL + anon key → click **Log in / Test**
6. *(Optional)* **GitHub** → paste Personal Access Token → click **Log in with token**
7. Back to <http://localhost:3000> → start chatting

---

## 5. Common errors & fixes

### ❌ `'NODE_OPTIONS' is not recognized` (Windows)

**Cause**: old `package.json` used Unix-only env-var syntax.
**Fix**: pull the latest `package.json` — DTB now uses `cross-env` which works on Windows/macOS/Linux. If you're patching manually, change the dev script to:

```json
"dev": "cross-env NODE_OPTIONS=--max-old-space-size=2048 next dev --hostname 0.0.0.0 --port 3000"
```

and run `yarn add -D cross-env`.

### ❌ `EACCES` or `permission denied` on Linux/Mac while installing yarn

Use sudo or fix npm prefix:
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g yarn
```

### ❌ `Error: listen EADDRINUSE: address already in use 0.0.0.0:3000`

Port 3000 is busy. Either:
- Stop the other process: PowerShell → `Get-NetTCPConnection -LocalPort 3000 | % { Stop-Process -Id $_.OwningProcess -Force }`
- Or change port: `yarn dev -- --port 3001`

### ❌ `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`

MongoDB not running. Start it:
- Windows: `net start MongoDB`
- macOS: `brew services start mongodb-community@7.0`
- Linux: `sudo systemctl start mongod`

DTB also works without MongoDB (it's optional — local-first storage uses `localStorage`).

### ❌ Ollama unreachable from DTB

Check Ollama is alive:
```bash
curl http://localhost:11434/api/tags
```
If `connection refused`:
- Windows: re-run `ollama serve` in a separate terminal, or restart Ollama from the system tray
- macOS: `brew services restart ollama`
- Linux: `sudo systemctl restart ollama`

### ❌ WebContainer mode fails to boot

- Open in **Chrome / Edge / Brave** (not Safari/Firefox)
- DevTools → Console → run `self.crossOriginIsolated` → must return `true`. If `false`, restart `yarn dev` and hard-reload (Ctrl+Shift+R).

### ❌ Path with parentheses (e.g. `C:\Down-to-Build (1)\…`)

Some Node modules fail with paths containing parens or spaces. Move the folder to a clean path:
```powershell
Move-Item "C:\Down-to-Build (1)\Down-to-Buildv1-main" C:\dtb
cd C:\dtb
```

### ❌ `yarn install` is very slow or stalls

Force a cache cleanup:
```bash
yarn cache clean
yarn install --network-timeout 600000
```

Or switch to a faster registry:
```bash
yarn config set registry https://registry.npmmirror.com
yarn install
yarn config set registry https://registry.yarnpkg.com   # reset
```

---

## 6. After-install checks

```powershell
# Verify all parts (Windows; tweak commands for *nix)
node -v
yarn -v
git --version
sc query MongoDB | findstr STATE
curl http://localhost:11434/api/tags
code --list-extensions | findstr saoudrizwan
```

Then in DTB:

1. `/api/health` → must return `{ "ok": true, "app": "DTB" }`
2. Generate a simple component (Single Component mode) — see streaming working
3. Switch to Fullstack (WebContainer) — see "▶ Run in browser" boot a Next.js inside the iframe

---

## 7. Next steps

- 👉 See [README.md](README.md) for full feature docs & output modes
- 👉 See [README.md → Build as a desktop app](README.md#-build-as-a-desktop-app-exe--dmg--appimage) to ship a `.exe` installer with Electron

---

MIT License.
