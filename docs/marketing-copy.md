# LogLens — Marketing Copy

All the text you'll need for different platforms and contexts. Pick the one that fits the character budget.

---

## Display Name (for `package.json` "displayName")

**Currently:** *"LogLens — MCP Log Investigator for Claude Code"*

Alternatives, ordered by what's clearest at-a-glance in Marketplace search:

| Option | Best for | Chars |
|--------|----------|-------|
| **LogLens — AI Log Investigator** | Generic discoverability | 32 |
| **LogLens — Log Analysis for Claude Code** | Audience targeting (current users of Claude Code) | 41 |
| **LogLens: AI-Powered Log Debugging** | SEO match for "log debugging" searches | 35 |
| **LogLens — Schema-driven Log Investigation** | Differentiation play | 42 |

**Recommendation:** `LogLens — AI Log Investigator for Claude Code` (42 chars, widely searchable, names the integration)

---

## Short Description (for `package.json` "description")

This shows under the extension name in search results. Limit: ~150 characters before truncation.

### Variant 1 — Feature-led (recommended, 142 chars)
> Schema-driven log analysis for Claude Code. Auto-installs an MCP server; talk to Claude in chat to investigate production issues. No API key.

### Variant 2 — Outcome-led (138 chars)
> Turn Claude Code into a domain-aware log investigator for your service. Schema-driven flows, pre-filled queries, root-cause analysis.

### Variant 3 — Problem-led (147 chars)
> Stop pasting raw logs at AI. LogLens teaches Claude Code about your service so debugging is guided, not guessed. Schema-driven. No API key.

### Variant 4 — Team-led (146 chars)
> Make every engineer debug like a senior. LogLens turns your repo's `.loganalysis/` schemas into Claude Code MCP tools for instant log RCA.

---

## Taglines (one-liners for tweets, decks, email signatures)

| Tagline | Use |
|---------|-----|
| *"AI log investigator that knows your service."* | Default tagline |
| *"Domain-aware debugging for Claude Code users."* | Audience-specific |
| *"Senior-engineer log triage, for the whole team."* | Onboarding angle |
| *"Stop pasting logs at AI. Start querying them."* | Punchy CTA |
| *"Schemas in your repo. Investigations in your chat."* | Architecture summary |

---

## GitHub repo description (250 chars max — settings → "About")

> VS Code extension that turns Claude Code into a domain-aware log investigator. Commit a `.loganalysis/` folder describing your service; teammates install LogLens and debug production issues from chat. MCP-based, no API key, MIT licensed.

(*245 chars — fits exactly*)

---

## Long description (Marketplace listing — first paragraph above the README fold)

Two-paragraph version that does the heavy lifting on the Marketplace page:

> **LogLens turns Claude Code into a domain-aware log investigator for your service.** It's a VS Code extension that auto-installs an MCP (Model Context Protocol) server containing 11 schema-driven tools — letting Claude pre-fill Loki / Datadog / CloudWatch queries, match logs against your known error patterns, and walk QA/Support/Engineers through guided incident playbooks.
>
> You commit a small `.loganalysis/` JSON folder to your repo describing your service's modules and correlation IDs (Claude can generate this for you on first run). Teammates install LogLens, click one button, and immediately can ask in Claude Code chat: *"Investigate: users can't sign in after the latest deploy."* No API key required — LogLens piggybacks on Claude Code's existing session via MCP. Open source, MIT licensed.

---

## VS Code Marketplace — "Categories"

Already set in `package.json`. For reference, these are the three you've chosen:

- **Programming Languages**
- **Debuggers**
- **Other**

If you publish a v0.2, consider also adding **AI** and **Testing** to widen discoverability.

---

## Keywords (already in package.json, for SEO)

Current set:
```json
"keywords": ["log analysis", "ai", "debugging", "rca", "claude", "claude code", "mcp", "module understanding"]
```

Consider adding: `"loki"`, `"datadog"`, `"production"`, `"incident"`, `"observability"`, `"sre"`, `"qa"`, `"copilot"`, `"cursor"` — these widen Marketplace search reach.

---

## App Store / installer descriptions (if you ever distribute outside Marketplace)

### Short (under 80 chars)
> Domain-aware log investigator for Claude Code.

### Medium (under 200 chars)
> LogLens turns Claude Code into a domain-aware log investigator for your service. Schema-driven flows, pre-filled queries, root-cause analysis — all from chat. No API key.

### Long (under 500 chars)
> LogLens is a VS Code extension that turns Claude Code into a domain-aware log investigator. Commit a small `.loganalysis/` folder describing your service's modules and error patterns; teammates install LogLens and immediately can debug production issues from Claude Code chat. The extension auto-installs an MCP server with 11 schema-driven tools — pre-filled Loki queries, error pattern matching, and incident playbooks. No API key required. Open source, MIT licensed.

---

## Email signature blurb (one line)

> Building [LogLens](https://github.com/vikram9410/loglens) — AI log investigator for Claude Code. ⚡

---

## Conference talk pitch (45 seconds, for podcast/event intros)

> "I built LogLens because debugging production logs feels like archaeology — every incident needs the right correlation ID, the right query, and knowledge of which module logs what. All of that lives in senior engineers' heads. LogLens makes that knowledge explicit: you commit a JSON schema describing your service, and Claude Code uses MCP tools to walk anyone — QA, support, junior dev — through the investigation. It's schema-driven, takes no API key, and is open source. The 'aha' moment is that every post-incident pattern your team adds becomes durable, version-controlled debugging wisdom."

---

## Pull-quote (for press kit / website testimonials)

> *"LogLens makes domain-specific debugging knowledge a first-class artifact in the repo — versioned, reviewable, and shared via git. It's what observability tooling has been missing."*

---

## SEO meta description (for docs/index.html `<meta name="description">`)

Currently set to:
> *"VS Code extension that turns Claude Code into a domain-aware log investigator for your service. Schema-driven, no API key required."*

**Recommended replacement (140 chars, optimized for Google):**
> *"VS Code extension turning Claude Code into a domain-aware log investigator. Schema-driven debugging, pre-filled Loki queries, no API key needed."*

---

## Where each goes — quick reference

| Text | Lives in | Length budget |
|------|----------|---------------|
| Display Name | `package.json` `"displayName"` | 60 chars |
| Short Description | `package.json` `"description"` | 150 chars |
| Long Description | `README.md` (Marketplace renders it) | unlimited |
| Repo Description | GitHub repo settings → About | 250 chars |
| Tagline | LinkedIn post / social media bio | 100 chars |
| SEO Description | `docs/index.html` `<meta name="description">` | 160 chars |
| Email blurb | Email signature, slack bio | 80 chars |
