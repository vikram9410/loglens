# LinkedIn Post Copy — LogLens Launch

Copy any variant below verbatim and paste it alongside the carousel PDF when you create the LinkedIn Document post.

> **Format rule for LinkedIn:** The first two lines decide whether someone clicks "see more." Hook hard.

---

## ✨ Variant 1 — The Story (Recommended)

> Last week, a new hire spent 2 hours debugging an issue I'd have solved in 5 minutes.
>
> Not because they weren't capable. Because they didn't know:
>
> → Which correlation ID to grep for
> → Which Loki query to run
> → Which error patterns are normal vs scary
> → Which module is likely at fault
>
> All of that lived in my head.
>
> So I built **LogLens** — a VS Code extension that turns Claude Code into a domain-aware log investigator for your service.
>
> The trick: commit a small `.loganalysis/` JSON folder describing your modules and error patterns to your repo. Teammates install LogLens, click one button, and immediately can ask Claude Code in chat:
>
> *"Investigate: users can't sign in after the latest deploy"*
>
> Claude returns the right correlation ID to collect, a pre-filled Loki/Datadog query, known error patterns with root causes, and a step-by-step investigation playbook.
>
> **The unfair advantage: $0 per investigation.** LogLens uses Claude Code's existing session via MCP. No API key. No per-token cost.
>
> Open source, MIT licensed.
>
> Carousel below walks through the full flow 👇
>
> *Curious — what's the most time-consuming part of debugging production logs at your team? Drop a comment.*
>
> #vscode #claudecode #ai #devex #developertools #opensource #mcp

**Character count: ~1280** (LinkedIn limit is 3000, but ~1200-1500 is the sweet spot for engagement)

---

## ⚡ Variant 2 — The Punch (Best for short attention spans)

> Why does debugging production logs feel like archaeology?
>
> Because the answer to "which ID matters here?" lives in one senior engineer's head.
>
> So I built **LogLens** — a VS Code extension that turns Claude Code into a domain-aware log investigator for *your* service.
>
> Commit a small JSON folder describing your modules and error patterns. Teammates install the extension. Open Claude Code chat. Type:
>
> *"Investigate: checkout returning 500s"*
>
> Get back:
> ✅ The right correlation ID to collect
> ✅ A pre-filled Loki / Datadog / CloudWatch query
> ✅ Known error patterns matched against pasted logs
> ✅ Investigation playbooks from your team's collective experience
>
> The kicker: $0 per investigation. No API key. It piggybacks on Claude Code's LLM via MCP.
>
> Open source, MIT.
>
> Carousel below 👇
>
> #vscode #devex #ai #claudecode #opensource #mcp #observability

**Character count: ~880**

---

## 🛠️ Variant 3 — The Builder (For dev-focused audience like HN/r/programming crowd)

> Just shipped **LogLens** — a VS Code extension that turns Claude Code into a domain-aware log investigator via MCP (Model Context Protocol).
>
> Why I built it:
> Generic AI says "looks like a 500 error" when you paste logs.
> LogLens says "this matches your AUTH-002 pattern, root cause is JWT refresh failure, here's the playbook."
>
> How it works:
> 1️⃣ Commit a `.loganalysis/` folder to your repo (manifest + per-issue schemas)
> 2️⃣ Extension auto-installs an MCP server exposing 11 schema-driven tools
> 3️⃣ Anyone with Claude Code (or Copilot Chat, or Cursor) calls those tools in chat
> 4️⃣ Claude does the reasoning; LogLens supplies your team's domain context
>
> Architectural calls I made:
> 🔒 Extension itself NEVER calls an LLM. Zero API keys. Zero per-token cost.
> 🔌 Multi-client by default: writes config to `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json` on Setup
> 🩹 Self-heals on Marketplace auto-update (extension path changes on upgrade; we silently fix the config)
> 📦 Schemas live in git → debugging knowledge becomes a team asset that compounds with every incident
>
> Open source, MIT. Built with TypeScript, esbuild, Zod, and the @modelcontextprotocol/sdk.
>
> Carousel below 👇
>
> Would love feedback from anyone building with MCP — especially curious about your patterns for keeping schemas in sync with code as it evolves.
>
> #vscode #claudecode #mcp #ai #typescript #devtools #opensource #anthropic

**Character count: ~1380**

---

## 🎯 Variant 4 — The Question (Highest comment-driver)

> Pop quiz for engineers:
>
> When QA reports "the checkout broke," what's the FIRST thing you ask them for?
>
> If your answer is "the requestId," congratulations — you have a debugging-shaped knowledge silo on your team.
>
> Because:
> → New QA hires don't know to ask for it
> → Junior devs don't know which logs to grep
> → Support tickets bounce to senior engineers for triage
>
> All this tribal knowledge lives in heads, not in the repo.
>
> So I shipped **LogLens** — a VS Code extension that puts that knowledge BACK in the repo as a `.loganalysis/` schema, then lets Claude Code use it via MCP to guide ANYONE (QA, support, junior dev) through the investigation.
>
> One command. No API key. Open source.
>
> Walks you through:
> ✅ Which correlation ID to collect for this specific symptom
> ✅ A pre-filled Loki/Datadog query to copy-paste
> ✅ Known error patterns matched against logs you paste back
> ✅ The actual investigation playbook your senior engineers would follow
>
> Curious how your team handles this: do you have **written runbooks** for production debugging, or is it mostly senior-engineers-on-Slack?
>
> Carousel below 👇
>
> #vscode #devex #ai #claudecode #opensource #engineering #sre

**Character count: ~1240**

---

## Hashtag Strategy

**LinkedIn caps practical visibility at 3-5 hashtags.** Pick from these pools:

| Pool | Tags |
|------|------|
| **Broad reach** | #vscode #ai #developertools #devex #productivity #engineering #softwareengineering |
| **Tech-specific** | #mcp #claudecode #anthropic #typescript #opensource |
| **Audience-specific** | #qa #sre #devops #supportengineering #onboarding |
| **Trending (2026)** | #aitooling #devtools #agentic #llmtools |

**Best combos:**
- General launch → `#vscode #claudecode #ai #devex #opensource`
- For dev-tool builders → `#mcp #claudecode #anthropic #opensource #typescript`
- For team leads → `#engineering #devex #onboarding #ai #productivity`

---

## Post Structure That Wins on LinkedIn

```
[ HOOK — 2 lines max, makes them click "see more" ]

[ PROBLEM — relatable pain point ]

[ SOLUTION — what LogLens does ]

[ HOW IT WORKS — bullets/checklist for scannability ]

[ DIFFERENTIATOR — no API key + open source ]

[ CTA — "Carousel below" or a question ]

[ HASHTAGS — 4-6 max ]
```

All 4 variants above follow this structure. Pick whichever tone matches your voice.

---

## Engagement Tactics (post these in the first 30 min)

LinkedIn's algorithm rewards **engagement velocity**. Within 30 minutes of posting:

1. **Pin the post** to your profile
2. **Reply to the first 3 comments** within 1 hour each
3. **Tag 2-3 trusted teammates** with a DM asking them to engage if they find it useful (NOT in the post itself — looks spammy)
4. **Share to relevant LinkedIn groups** (e.g. "Software Developers," "DevOps Engineers," "Open Source Software")

---

## Reply Templates for Likely Comments

**"This looks great! How do I try it?"**
> Thanks 🙏 Install LogLens from the VS Code Marketplace, open your repo, click Setup when prompted. Then ask Claude Code in chat to generate a starter schema. ~30 seconds total. Source + setup guide: github.com/vikram9410/loglens

**"How is this different from [Datadog AI / New Relic AI Monitoring / Sentry's AI]?"**
> Great question. Those are platform-side AI features that work on logs already in their system. LogLens is upstream — it encodes YOUR team's domain knowledge (modules, correlation IDs, known error patterns) in your repo, then lets ANY MCP client (Claude Code, Copilot, Cursor) use it via tools. It's framework-agnostic and observability-backend agnostic.

**"Does it work with Python / Go / Java?"**
> Yes — schemas are framework-agnostic. The scanner auto-detects winston, pino, log4j2, @tsed/logger, bunyan, slf4j, Python `logging`, Go zap, logrus, and more. If your stack isn't auto-detected, you can hand-author the schema or have Claude refine what it generates.

**"What about privacy / data leaving my machine?"**
> Extension makes ZERO outbound network calls. Schemas are plain JSON in your repo. Claude Code controls all data flow (under its existing trust boundary that you've already accepted). No telemetry, no tracking, no API keys to leak.

**"Show me the code"**
> github.com/vikram9410/loglens — MIT licensed. Especially interested in framework-specific starter schemas (NestJS, Spring Boot, Django, FastAPI) for a future public schema registry. PRs welcome.

---

## Follow-up Post Schedule (4-week rollout)

Don't dump everything at once. Spread these across a month for compounding LinkedIn reach:

| Week | Post Type | What to share |
|------|-----------|---------------|
| **1** | Launch carousel | This post + 10-slide PDF |
| **2** | Single-image post | Slide 9 alone ("Before/After") with a caption about how much time it saves |
| **3** | Text post | "3 lessons from shipping an MCP-based VS Code extension" — technical reflection |
| **4** | Short video (60s) | Screen recording of an actual investigation flow |

---

## Cross-Platform Repurposing

| Platform | Variant to use | Modifications |
|----------|---------------|---------------|
| **X / Twitter** | Variant 2 (shortest) | Split into 8-tweet thread; one bullet per tweet |
| **Hacker News** | Variant 3 (Builder) | Submit as "Show HN: LogLens — schema-driven log investigator for Claude Code" |
| **r/programming** | Variant 3 | Add specific MCP tool count, list architectural decisions in detail |
| **r/vscode** | Variant 1 (Story) | Add "first time publishing to Marketplace" angle |
| **dev.to / Medium** | Long-form expansion of Variant 3 | Add code samples, architecture diagrams from the docs site |
| **Internal Slack (your team)** | Variant 2 + invite to test | "Hey team, I built this — would love your beta feedback" |
