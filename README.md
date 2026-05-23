<p align="center">
  <img src="images/logo.png" alt="LogLens" width="360">
</p>

<p align="center">
  <strong>AI Log Investigator for Claude Code</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=vikram.loglens-vscode"><img src="https://img.shields.io/badge/version-0.1.0-blue.svg" alt="Version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://claude.com/claude-code"><img src="https://img.shields.io/badge/powered%20by-Claude%20Code-7C3AED.svg" alt="Powered by Claude Code"></a>
</p>

> **Turn Claude Code into a domain-aware log investigator for your service.** Schema-driven flows, pre-filled Loki queries, root-cause analysis — all inside Claude Code's chat. **No API key required.**

LogLens is a VS Code extension that auto-installs an **MCP server** for [Claude Code](https://claude.com/claude-code). You commit a small `.loganalysis/` folder to your repo describing your service's modules and error patterns; teammates install the extension, click one button, and immediately can ask Claude Code:

> *"Agent says mute is not working, interactionId is `abc-123`"*

Claude calls LogLens, returns ready-to-paste Loki queries, known error patterns, root causes, and a step-by-step investigation playbook.

---

## ✨ Features

| | |
|---|---|
| 🔍 **Guided investigations** | Describe an issue in plain English → Claude asks for the right correlation ID → returns Loki queries + error patterns + playbook |
| 🧠 **AI schema generation** | Ask Claude to scan your codebase; it generates `.loganalysis/` schemas for you. Commit and share. |
| 📖 **Module Q&A** | Right-click a folder → Claude explains its purpose, data flow, error patterns, and debugging tips |
| 🔬 **Log analysis** | Paste raw logs → Claude matches against known patterns and identifies root cause |
| 🚀 **Zero API key** | Uses Claude Code's own LLM via MCP. No Anthropic / OpenAI key needed. |
| 👥 **Team-friendly** | Schemas live in your repo. Teammates install LogLens and start debugging immediately. |
| 📁 **Multi-repo** | Monorepos with multiple `.loganalysis/` folders are auto-discovered |
| 🔒 **Privacy-first** | Nothing leaves your machine. The extension makes no network calls; Claude Code controls all data flow. |

---

## 🚀 Quick Start

### Requirements

- **VS Code 1.85+** (or [Cursor](https://cursor.com) — VS Code fork)
- **One of these MCP-aware AI clients** installed:
  - [Claude Code](https://claude.com/claude-code) — reads `.mcp.json`
  - [GitHub Copilot Chat](https://github.com/features/copilot) — reads `.vscode/mcp.json`
  - [Cursor](https://cursor.com) (its built-in AI) — reads `.cursor/mcp.json`
- **Node.js 18+** on PATH (used to spawn the MCP server subprocess)

LogLens writes the MCP server entry to **all three config locations** on Setup, so it works with whichever client you have (or install later).

### Installation

1. Install **LogLens** from the VS Code Marketplace (search "LogLens")
2. Open your service repo in VS Code
3. Click **Setup** when the activation notification appears
4. Reload VS Code

That's it — **30 seconds**. Now talk to Claude Code in chat.

### First-time schema generation (schema author, one person)

In Claude Code chat:

> *"Use LogLens to scan this codebase and generate a starter .loganalysis schema"*

Claude scans the codebase, drafts the schemas, asks you to confirm, then writes them. Review the generated files, refine if needed, and **commit them to git**.

### Daily usage (every teammate)

After `git pull` brings in the committed `.loganalysis/`:

> *"Agent says mute is not working — investigate"*

Claude returns:
- The correlation ID needed (e.g., `interactionId`)
- Pre-filled Loki / Grafana query templates
- Specific error patterns to look for with regex + root cause
- Step-by-step investigation playbook

Paste collected logs back to Claude:

> *"Here are the logs: [paste]"*

Claude pattern-matches them against your schema and pinpoints the root cause.

---

## 🎯 Why LogLens?

| Without LogLens | With LogLens |
|----------------|-------------|
| Engineer pastes 1000 log lines at ChatGPT, gets generic advice | Claude returns module-specific patterns and root causes |
| Each issue needs a different correlation ID — hard to remember which | Claude tells you exactly which ID to collect for your symptom |
| Onboarding new QA/support takes weeks | They install the extension and use Claude Code chat from day one |
| Knowledge of error patterns lives in senior engineers' heads | Schemas are committed alongside code, evolve with the repo |
| Most AI log tools require an API key + per-token cost | Uses Claude Code's existing session — no extra cost |

---

## 📚 How It Works

```
VS Code Extension                  Bundled MCP Server                Claude Code
─────────────────                  ──────────────────                ───────────
• Auto-installs MCP server         • Reads .loganalysis/             • Reads .mcp.json
• Detects .loganalysis/ folder     • Exposes 11 tools                • Spawns mcp-server
• One-click setup writes           ▶ list_issue_analyses             • Calls tools in chat
  .mcp.json                        ▶ start_investigation             • Reasons with its
• Schema explorer tree view        ▶ analyze_logs                       own LLM
• NO LLM calls                     ▶ scan_codebase_for_loggers       • Writes schema files
• NO API keys                      ▶ propose_schema_updates             via its edit tools
                                   ▶ ... and 6 more
```

The extension is a **thin auto-installer**. All intelligence runs inside Claude Code via MCP tools.

---

## 📂 Schema Structure

After setup, your repo has:

```
.loganalysis/
├── manifest.json                       ← Index of all issue analyses
├── general-context-schema.json         ← Service overview, correlation keys, modules
└── <issue-id>-analysis-schema.json    ← One per issue type (api-errors, auth-failures, etc.)
```

**Commit this folder.** Teammates inherit the schemas through git.

### Minimal example

```json
// manifest.json
{
  "repo": "my-service",
  "description": "My HTTP API service",
  "generalContext": "general-context-schema.json",
  "issueAnalyses": [
    {
      "id": "api-errors",
      "name": "API Errors",
      "file": "api-errors-analysis-schema.json",
      "keywords": ["error", "500", "timeout"],
      "primaryCorrelationId": "requestId"
    }
  ]
}
```

Each issue analysis defines: keywords (for matching user descriptions), primary correlation ID, relevant modules, error patterns with regex + root cause, and investigation playbooks.

---

## ⚡ Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | What it does |
|---------|--------------|
| `LogLens: Setup MCP Integration for Claude Code` | One-click setup — writes `.mcp.json` |
| `LogLens: Validate Schemas` | Re-load and report schema errors |
| `LogLens: List Issue Categories` | Quick-pick all available categories |
| `LogLens: Open Claude Code` | Focus the Claude Code panel |
| `LogLens: Copy 'Explain this module' Prompt` | Right-click a folder → copies a ready-to-paste prompt |

---

## 🛠️ Configuration

| Setting | Default | Purpose |
|---------|---------|---------|
| `loglens.schemaFolder` | `.loganalysis` | Folder name (relative to workspace root) where schemas live |

That's it. **No LLM provider settings. No API keys. No models to choose.**

---

## 💡 Example Prompts

Once set up, here's what you can ask Claude Code:

**Investigate an incident:**
> *"Use LogLens to investigate: customer says the call dropped suddenly"*

**Analyze a log block:**
> *"Use LogLens to analyze these logs and tell me the root cause: [paste]"*

**Generate or refresh schemas:**
> *"Use LogLens to scan this codebase and propose updated schemas based on recent changes"*

**Explain a module:**
> *"Use LogLens list_module_files to explain src/payments — what does it do and where can it fail?"*

**List what's available:**
> *"List all repos and issue categories LogLens knows about"*

---

## 🔒 Privacy

- **No data ever leaves your machine** unless Claude Code sends it (your existing Claude Code agreement applies)
- **No telemetry** — the extension makes zero outbound network calls
- **No API keys** stored, anywhere
- **Schemas stay in your repo** — they're plain JSON files you control and commit

---

## 🐛 Troubleshooting

**Tools not showing in `/mcp`**
→ Did you reload VS Code after Setup? `Ctrl+R` in the window. Then check `/mcp` again.

**"No schemas found"**
→ Either your repo doesn't have `.loganalysis/` yet (ask Claude to generate one), or the folder is named differently — check `loglens.schemaFolder` setting.

**MCP server crashes**
→ Open a terminal and run:
```
node "<extension-install-path>/dist/mcp-server.mjs" --workspace "<your-repo>"
```
Should sit idle waiting for input. If it errors, check the message — most often a schema validation error.

**Activation notification doesn't appear**
→ Either you've already dismissed it once, or `.mcp.json` already has a `loglens` entry. Run `LogLens: Setup MCP Integration for Claude Code` manually.

---

## 🧰 Requirements

- **VS Code 1.85+** or compatible (VSCodium, Cursor)
- **Claude Code** extension installed and logged in
- **Node.js 18+** on `PATH` (used to spawn the MCP server subprocess)

---

## 🗺️ Roadmap

- ✅ MCP server with 9 schema-driven tools
- ✅ VS Code extension auto-installer
- ✅ Multi-repo / monorepo support
- ✅ AI schema generation via Claude Code
- 🔜 Loki / Grafana direct integration (fetch logs from inside the extension)
- 🔜 Datadog / CloudWatch / Elastic backends
- 🔜 Public schema registry for popular frameworks (Spring Boot, NestJS, Django, FastAPI)
- 🔜 Schema versioning + migration tool
- 🔜 Live log tailing during investigation

---

## 🤝 Contributing

LogLens is open source under the **MIT License**. Issues, PRs, and schema contributions are welcome.

- **Source:** [github.com/vikram9410/loglens](https://github.com/vikram9410/loglens)
- **Issues:** [github.com/vikram9410/loglens/issues](https://github.com/vikram9410/loglens/issues)
- **Discussions:** [github.com/vikram9410/loglens/discussions](https://github.com/vikram9410/loglens/discussions)

### Sharing schemas

If you build a schema for a popular framework, please contribute it to the upcoming public schema registry. One author's effort becomes everyone's onboarding accelerator.

---

## 📜 License

MIT © LogLens contributors

---

## 🙏 Acknowledgments

Built on top of:
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) — Anthropic's protocol for AI tool integration
- [Claude Code](https://claude.com/claude-code) — the AI that does the actual reasoning
- [Zod](https://zod.dev) — schema validation
- [esbuild](https://esbuild.github.io) — bundling the MCP server

---

**Made for engineers who'd rather investigate than google their own error messages.**
