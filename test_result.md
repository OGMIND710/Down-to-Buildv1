#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  DTB (Down To Build): Next.js split-screen workspace for building React components with AI.
  Latest iteration adds:
  - Dedicated /settings page (LLM, Ollama, Supabase login, GitHub login, system prompt)
  - Token-by-token streaming for all providers
  - Modern grey/white UI (light mode default)
  - Global settings + per-project overrides

backend:
  - task: "Health endpoint /api/health"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Returns { ok:true, app:'DTB' }"
      - working: true
        agent: "testing"
        comment: "✅ PASS: GET /api/health returns 200 with {ok: true, app: 'DTB'}"

  - task: "LLM proxy /api/llm/chat (non-streaming)"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Proxies Ollama/OpenAI/Anthropic/Groq/OpenRouter. Should return 400 for unknown provider; 500 for invalid Ollama URL; valid JSON shape { content: string }. NO valid API keys available - test only invalid-provider rejection and Ollama unreachable-error path."
      - working: true
        agent: "testing"
        comment: "✅ PASS: Returns 400 with 'Unknown provider' for invalid provider. Returns 500 with error field for unreachable Ollama. Minor: error message is 'fetch failed' instead of mentioning 'Ollama' specifically, but core functionality works (proper status codes, valid JSON, error field present)."

  - task: "LLM streaming /api/llm/stream"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "ReadableStream returning plain text chunks. For ollama: NDJSON parse. For OpenAI/Groq/OpenRouter: SSE parse data: lines, skip [DONE]. For Anthropic: SSE content_block_delta. Without keys, test that unreachable Ollama returns body starting with __DTB_ERROR__."
      - working: true
        agent: "testing"
        comment: "✅ PASS: Returns 500 with valid JSON error for unreachable Ollama. Does not crash. Error handling works correctly."

  - task: "Ollama list models /api/ollama/models"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST { baseUrl } -> calls /api/tags. Expect 500 with error when Ollama unreachable."
      - working: true
        agent: "testing"
        comment: "✅ PASS: Returns 500 with error 'Cannot reach Ollama at http://127.0.0.1:1/api/tags: fetch failed' when Ollama is unreachable."

  - task: "Supabase sync /api/sync/supabase"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Actions: test/push/pull. Without real Supabase project, test that missing url/key returns 400 'Supabase URL/key missing' and unknown action returns 400."
      - working: true
        agent: "testing"
        comment: "✅ PASS: Returns 400 with 'Supabase URL/key missing' when credentials are missing. Returns 500 with error when fake credentials are used. Minor: error message format differs but core functionality works."

  - task: "GitHub user validation /api/sync/github/user"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST { token } -> GET https://api.github.com/user. With invalid token should return 500 with 'GitHub: 401' error. No real token available."
      - working: true
        agent: "testing"
        comment: "✅ PASS: Returns 500 with error 'GitHub: 401' when invalid token is provided."

  - task: "GitHub push /api/sync/github"
    implemented: true
    working: true
    file: "app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Missing token/repo/path should return 400. With invalid token should return 500 with 'GitHub push: 401'."
      - working: true
        agent: "testing"
        comment: "✅ PASS: Returns 400 with 'token/repo/path required' when params are missing. Returns 500 with 'GitHub push: 401' when invalid token is provided."

frontend:
  - task: "Workspace UI (chat + preview + per-project overrides dialog)"
    implemented: true
    working: "NA"
    file: "app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Light mode grey/white. Not auto-tested yet."

  - task: "Settings page /settings"
    implemented: true
    working: "NA"
    file: "app/settings/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "5 sections, Supabase test, GitHub login validates PAT. Not auto-tested yet (waiting for user permission)."

  - task: "Embedded WebContainer in workspace Preview tab"
    implemented: true
    working: "NA"
    file: "app/page.js + components/WebContainerRunner.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Moved the WebContainer runner out of /run/[id] (kept as optional fullscreen) into the right Preview panel of the workspace.
          - Dynamic-imported components/WebContainerRunner.jsx with ssr:false in app/page.js
          - When outputMode='webcontainer' AND files.length>0, the embedded runner appears in the Preview tab with terminal + iframe split (compact mode).
          - The 'Run in browser' CTA was replaced by a smaller '↗ Fullscreen' link to /run/[id] for users who want full-screen mode.
          - On successful multi-file generation, the workspace now auto-switches to the Preview tab for webcontainer mode (instead of the Files tab).
          - COOP/COEP headers in next.config.js already cover '/(.*)', so cross-origin isolation works on the root.
          Manual test: open /, switch to WebContainer mode in /settings, generate a Next.js project, expect the runner to appear inline.

  - task: "Force npx --yes in WebContainer-generated package.json"
    implemented: true
    working: "NA"
    file: "lib/dtb-store.js + components/WebContainerRunner.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          Two-layer fix for 'jsh: command not found: next':
          1. lib/dtb-store.js MULTIFILE_FORMAT prompt now explicitly instructs the AI to write
             "dev": "npx --yes next dev -p 3000" (and similar for vite/nodemon) instead of bare binaries.
          2. components/WebContainerRunner.jsx sanitizePackageJson() patches any package.json the LLM
             still emits with bare next/vite/nodemon by prepending 'npx --yes ' before mounting.
          3. A runtime fallback in WebContainerRunner watches dev output for 'command not found' and
             auto-spawns 'npx --yes next dev -p 3000' as a recovery.
          Manual test: generate a Next.js project in WebContainer mode, expect the dev server to start
          without 'command not found'.

metadata:
  created_by: "main_agent"
  version: "2.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Tested manually: /api/health works, /api/llm/chat rejects unknown provider with 400.
      Please test:
      1. /api/health returns { ok: true, app: 'DTB' }
      2. /api/llm/chat with body { provider: 'invalid', messages: [] } returns 400
      3. /api/llm/chat with body { provider: 'ollama', baseUrl: 'http://127.0.0.1:1', model: 'x', messages: [{role:'user',content:'hi'}] } returns 500 with error message (Ollama unreachable)
      4. /api/llm/stream with same Ollama-unreachable body: response body should be a text/plain stream starting with '__DTB_ERROR__' OR a 200/500 with error message in body
      5. /api/ollama/models with { baseUrl: 'http://127.0.0.1:1' } returns 500 with error
      6. /api/sync/supabase with { action: 'test' } (no url/key) returns 400 'Supabase URL/key missing'
      7. /api/sync/supabase with { action: 'foobar', url: 'https://x.supabase.co', key: 'k' } returns 400 'Unknown action' (it will actually try and fail upstream; alternative acceptable: it tries the request and returns 500)
      8. /api/sync/github/user with { token: 'invalid_token_xxx' } returns 500 with error mentioning '401' or 'GitHub'
      9. /api/sync/github with empty body returns 400 'token/repo/path required'
      10. /api/sync/github with { token:'invalid', repo:'no/such-repo', path:'a.jsx', content:'x' } returns 500 with GitHub error
      
      No external API keys are available, so happy-paths cannot be fully tested. Focus on negative-path validation and that the proxy doesn't crash.
  - agent: "testing"
    message: |
      ✅ Backend testing complete! All 10 API endpoints tested successfully.
      
      Test Results Summary:
      1. ✅ GET /api/health - Returns 200 with {ok: true, app: 'DTB'}
      2. ✅ POST /api/llm/chat (invalid provider) - Returns 400 with 'Unknown provider'
      3. ✅ POST /api/llm/chat (Ollama unreachable) - Returns 500 with error field (minor: error message is 'fetch failed' instead of mentioning 'Ollama')
      4. ✅ POST /api/llm/stream (Ollama unreachable) - Returns 500 with error, does not crash
      5. ✅ POST /api/ollama/models (Ollama unreachable) - Returns 500 with 'Cannot reach Ollama' error
      6. ✅ POST /api/sync/supabase (missing credentials) - Returns 400 with 'Supabase URL/key missing'
      7. ✅ POST /api/sync/supabase (fake credentials) - Returns 500 with error (minor: error message format differs)
      8. ✅ POST /api/sync/github/user (invalid token) - Returns 500 with 'GitHub: 401'
      9. ✅ POST /api/sync/github (missing params) - Returns 400 with 'token/repo/path required'
      10. ✅ POST /api/sync/github (invalid token) - Returns 500 with 'GitHub push: 401'
      
      All endpoints return proper HTTP status codes, valid JSON responses, and handle errors gracefully without crashing.
      Minor issues noted are cosmetic (error message wording) and do not affect core functionality.
      
      All backend tasks marked as working: true, needs_retesting: false.
