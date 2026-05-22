#!/usr/bin/env bash
# ============================================================
# DTB - Down To Build : macOS / Linux installer
# Installs: Node LTS, Yarn, Git, MongoDB, Ollama, project deps
# Configures: .env, optionally pulls a coding model
# ============================================================
set -e

BLU="\033[34m"; GRN="\033[32m"; YLW="\033[33m"; RED="\033[31m"; NC="\033[0m"
ok()    { echo -e "${GRN}[OK]${NC} $1"; }
info()  { echo -e "${BLU}[..]${NC} $1"; }
warn()  { echo -e "${YLW}[!]${NC}  $1"; }
err()   { echo -e "${RED}[X]${NC}  $1"; }

cat <<'BANNER'

 =============================================================
                                                            
                  DTB  -  DOWN TO BUILD                     
            macOS / Linux installer / bootstrap             
                                                            
 =============================================================

BANNER

# ---------- Detect OS ----------
OS="unknown"
case "$(uname -s)" in
    Darwin*)  OS="mac" ;;
    Linux*)   OS="linux"
              if   [ -f /etc/debian_version ]; then DISTRO="debian"
              elif [ -f /etc/fedora-release ]; then DISTRO="fedora"
              elif [ -f /etc/arch-release  ]; then DISTRO="arch"
              else DISTRO="other"
              fi ;;
    *)        err "Unsupported OS: $(uname -s)"; exit 1 ;;
esac
ok "Detected: $OS${DISTRO:+ ($DISTRO)}"
echo

# ---------- 1. Package manager check ----------
info "[1/9] Checking system package manager..."
if [ "$OS" = "mac" ]; then
    if ! command -v brew >/dev/null 2>&1; then
        info "Homebrew not found. Installing..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    else
        ok "Homebrew available."
    fi
elif [ "$OS" = "linux" ]; then
    case "$DISTRO" in
        debian) sudo apt-get update -y ;;
        fedora) ;;
        arch)   ;;
        *) warn "Unknown distro - install commands may fail." ;;
    esac
fi
echo

# ---------- 2. Node.js LTS ----------
info "[2/9] Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
    info "Installing Node.js LTS..."
    case "$OS" in
        mac) brew install node@20 && brew link --overwrite --force node@20 ;;
        linux)
            case "$DISTRO" in
                debian) curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
                        sudo apt-get install -y nodejs ;;
                fedora) sudo dnf module install -y nodejs:20/common ;;
                arch)   sudo pacman -S --noconfirm nodejs npm ;;
                *) err "Install Node.js 20+ manually then re-run."; exit 1 ;;
            esac ;;
    esac
fi
ok "Node $(node -v)"
echo

# ---------- 3. Git ----------
info "[3/9] Checking Git..."
if ! command -v git >/dev/null 2>&1; then
    info "Installing Git..."
    case "$OS" in
        mac)   brew install git ;;
        linux) case "$DISTRO" in
                  debian) sudo apt-get install -y git ;;
                  fedora) sudo dnf install -y git ;;
                  arch)   sudo pacman -S --noconfirm git ;;
               esac ;;
    esac
fi
ok "Git $(git --version | awk '{print $3}')"
echo

# ---------- 4. Yarn ----------
info "[4/9] Checking Yarn..."
if ! command -v yarn >/dev/null 2>&1; then
    info "Installing Yarn globally via npm..."
    sudo npm install -g yarn 2>/dev/null || npm install -g yarn
fi
ok "Yarn $(yarn -v)"
echo

# ---------- 5. MongoDB ----------
info "[5/9] Checking MongoDB Community..."
if ! command -v mongod >/dev/null 2>&1; then
    info "Installing MongoDB 7.0..."
    case "$OS" in
        mac)
            brew tap mongodb/brew
            brew install mongodb-community@7.0
            brew services start mongodb-community@7.0 || true
            ;;
        linux)
            case "$DISTRO" in
                debian)
                    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
                        sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
                    . /etc/os-release
                    echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/${ID} ${VERSION_CODENAME:-jammy}/mongodb-org/7.0 multiverse" | \
                        sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list >/dev/null
                    sudo apt-get update -y
                    sudo apt-get install -y mongodb-org
                    sudo systemctl enable --now mongod
                    ;;
                fedora)
                    sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo >/dev/null <<EOF
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF
                    sudo dnf install -y mongodb-org
                    sudo systemctl enable --now mongod
                    ;;
                arch)
                    warn "Arch: install mongodb-bin from AUR manually (yay -S mongodb-bin)."
                    ;;
            esac ;;
    esac
else
    ok "MongoDB already installed."
fi
# Verify
if pgrep -x mongod >/dev/null 2>&1 || pgrep -fl "mongodb-community" >/dev/null 2>&1; then
    ok "MongoDB is running."
else
    warn "MongoDB is installed but not running. Start it manually if you need it."
fi
echo

# ---------- 6. Ollama ----------
info "[6/9] Checking Ollama..."
if ! command -v ollama >/dev/null 2>&1; then
    info "Installing Ollama..."
    case "$OS" in
        mac)   brew install ollama
               brew services start ollama || true ;;
        linux) curl -fsSL https://ollama.com/install.sh | sh
               # install.sh sets up systemd on linux automatically
               ;;
    esac
fi
ok "Ollama $(ollama --version 2>/dev/null || echo installed)"

echo
read -rp "    Pull coding model qwen2.5-coder:7b now? (~4.7 GB) [y/N]: " PULLM
if [[ "$PULLM" =~ ^[Yy]$ ]]; then
    # Make sure ollama daemon is up
    if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        info "Starting ollama daemon in background..."
        ollama serve >/tmp/ollama.log 2>&1 &
        sleep 3
    fi
    ollama pull qwen2.5-coder:7b
fi
echo

# ---------- 7. Project sanity ----------
info "[7/9] Checking DTB project root..."
if [ ! -f "package.json" ]; then
    err "package.json NOT found. Run this from the DTB project root."
    echo "    git clone <your-repo-url> dtb && cd dtb && ./install.sh"
    exit 1
fi
ok "Found package.json in $(pwd)."
echo

# ---------- 8. .env ----------
info "[8/9] Configuring environment variables..."
if [ -f .env ]; then
    ok ".env already exists - left untouched."
else
    cat > .env <<EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=dtb
NEXT_PUBLIC_BASE_URL=http://localhost:3000
CORS_ORIGINS=*
EOF
    ok ".env created with defaults."
fi
echo

# ---------- 9. yarn install ----------
info "[9/9] Installing JS dependencies (this can take a few minutes)..."
yarn install
echo

cat <<'DONE'

 =============================================================

           DTB INSTALLED SUCCESSFULLY                      

 =============================================================

  Next steps:
    * Start DTB :   yarn dev
    * Open      :   http://localhost:3000
    * Settings  :   http://localhost:3000/settings
    * Ollama    :   ollama serve  (in another terminal if needed)

  Models to pull later (optional):
    ollama pull llama3.2              # 3B, fast
    ollama pull qwen2.5-coder:7b      # best for coding
    ollama pull deepseek-coder-v2     # 16B, very capable

DONE

read -rp "Start DTB dev server now? [Y/n]: " STARTNOW
if [[ ! "$STARTNOW" =~ ^[Nn]$ ]]; then
    info "Launching yarn dev (Ctrl+C to stop)..."
    yarn dev
fi
