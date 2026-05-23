# Changelog

All notable changes to **LogLens** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Logo + icon** — gradient magnifying-glass mark (purple→blue) reflecting "investigate logs" theme. SVG source in `docs/assets/`; 128×128 PNG generated at build time via `npm run build:icon` (uses `@resvg/resvg-js`). Wired into `package.json` as the Marketplace icon.
- **Multi-client MCP support** — Setup now writes the LogLens MCP server entry to all three locations: `.mcp.json` (Claude Code), `.vscode/mcp.json` (GitHub Copilot Chat), and `.cursor/mcp.json` (Cursor). Works with whichever AI client the user has installed (or installs later).
- Self-heal logic now checks and updates the path in all three locations on upgrade.
- First-run prompt is suppressed if any of the three client configs already contain a `loglens` entry.
- **JSONC-safe config merging** — uses `jsonc-parser` (Microsoft's official package) to read `mcp.json` files. User comments and trailing commas no longer cause LogLens to think the file is empty.
- **Refuse-to-overwrite safety** — if an MCP config file exists but cannot be parsed (corrupt JSON, etc.), LogLens **refuses to write** and surfaces the parse error in a modal warning, instead of silently destroying the user's existing entries. Self-heal applies the same rule.

### Planned
- Loki / Grafana direct fetch (auto-pull logs given a query)
- Datadog / CloudWatch / Elastic backends
- Public schema registry for popular frameworks (Spring Boot, NestJS, Django, FastAPI)
- Schema versioning + migration tool
- Live log tailing during investigation

---

## [0.1.0] — 2026-05-18

### First public release.

LogLens is a VS Code extension that turns Claude Code into a domain-aware log investigator for your service. Schema-driven flows, pre-filled Loki queries, root-cause analysis — all inside Claude Code's chat. No API key required.

### Added

#### Extension
- One-click setup command **`LogLens: Setup MCP Integration for Claude Code`** that writes a workspace `.mcp.json` pointing at the bundled MCP server.
- Activity-bar tree view (**Schemas**) that auto-discovers any `.loganalysis/` folder in the workspace (monorepo-friendly).
- Status-bar item that focuses Claude Code chat with a starter prompt.
- First-run notification prompting users to set up MCP when LogLens activates on a workspace without an existing `loglens` entry in `.mcp.json`.
- **Self-heal on upgrade** — every activation checks `.mcp.json` for a stale extension path and silently rewrites it after a Marketplace auto-update. Shows a one-time "Reload to use the new version" toast per version.
- Right-click context menu on Explorer folders: **`LogLens: Copy 'Explain this module' Prompt`** — copies a ready-to-paste prompt to the clipboard.
- Commands:
  - `LogLens: Validate Schemas`
  - `LogLens: List Issue Categories`
  - `LogLens: Open Claude Code`
- Configurable schema folder name via `loglens.schemaFolder` setting (default `.loganalysis`).

#### MCP Server (bundled, ESM, no external deps at runtime)
- **`start_investigation`** — 3-step guided flow: plain-language description → required correlation ID → pre-filled Loki queries + error patterns + playbook.
- **`list_issue_analyses`** — Lists issue categories. Handles monorepos by listing across all detected repos when called with no `repo` arg.
- **`get_general_context`** — Returns service overview, correlation keys, modules, noise filters, AI prompt template.
- **`get_issue_analysis`** — Full schema for one issue type (error patterns, playbooks, detailed fields to watch).
- **`analyze_logs`** — Pattern-match a raw log block against all known error patterns; returns detected modules, matched patterns, extracted correlation keys, and suggested issues. No LLM call.
- **`scan_codebase_for_loggers`** — Walks the workspace, detects logger libraries (winston, pino, log4js, @tsed/logger, bunyan, slf4j, Python `logging`, Go zap, logrus, etc.), samples error/warn calls, finds correlation field candidates. Returns a JSON profile suitable for AI schema generation.
- **`get_schema_template`** — Returns the canonical required JSON shape for `manifest.json`, `general-context-schema.json`, and per-issue analyses with valid examples. Eliminates trial-and-error during schema generation.
- **`validate_schema`** — Dry-run validate a JSON string against the LogLens schema before writing to disk. Returns `✅ valid` or specific Zod errors.
- **`propose_schema_updates`** — Diffs a fresh codebase scan against current `.loganalysis/` schemas and proposes targeted updates. Two modes:
  - With `description` (+ optional `targetPath`): focused update for a specific new feature/module.
  - Without args: drift check across the whole codebase.
- **`list_module_files`** — Returns a file inventory + structural excerpts (exports, classes, top-level functions) for a given module folder. Powers module-explanation chat flow.
- **`reload_schemas`** — Force re-read of all schema files from disk. Includes folder inspection + Zod validation errors in its diagnostic output when schemas fail to load.
- **Auto-reload on every tool call** (throttled to 200 ms) — Claude can write new schema files mid-session and the next tool call picks them up without manual intervention.
- **Multi-repo / monorepo discovery** — Recursive scan finds `.loganalysis/` folders up to 4 directories deep, skipping `node_modules`, `dist`, `build`, etc.

#### Schema spec
- File-based schemas living in `.loganalysis/` (committed to the user's repo and shared via git).
- 3 file types per repo: `manifest.json`, `general-context-schema.json`, `<issue-id>-analysis-schema.json`.
- Lenient Zod validation — only `repo`, `id`, and `pattern` are strictly required; everything else is optional with safe defaults. AI-generated schemas don't get silently dropped for missing fields.
- Issue files can be flat or nested via the `file` field in `manifest.json`.

#### Docs
- Single-page static site (`docs/index.html`) — installable on GitHub Pages with no build step.
- README with installation, schema structure, command reference, and FAQ.
- Reference catalog of log statement patterns from a real production codebase (used to seed example schemas).

### Architecture decisions

- **No in-extension LLM calls.** Earlier prototype shipped with Anthropic / OpenAI / Claude-CLI providers; all removed in favor of the MCP-only model. The extension is now a thin auto-installer; all intelligence runs inside Claude Code via MCP tools.
- **No API key required.** Uses Claude Code's existing LLM session via the MCP protocol — zero per-token cost from LogLens.
- **Privacy-first.** Extension makes zero outbound network calls. Schemas are plain JSON in the user's repo. Claude Code controls all data flow under its existing trust boundary.

### Known limitations

- Requires the Claude Code VS Code extension (or another MCP-compatible client) installed and logged in.
- Node.js 18+ must be on PATH (used to spawn the MCP server subprocess).
- VS Code 1.85+ required.

---

[Unreleased]: https://github.com/vikram9410/loglens/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/vikram9410/loglens/releases/tag/v0.1.0
