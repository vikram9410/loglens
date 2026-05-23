# Pre-Release Checklist — LogLens

Step-by-step list of everything to do before publishing LogLens to the VS Code Marketplace. Work top-to-bottom — earlier sections are prerequisites for later ones.

---

## 1️⃣ Identity & branding (do this first)

- [ ] **Pick a Marketplace publisher name** (e.g. `your-org-name` or your personal handle)
- [ ] **Confirm the extension ID** in [package.json](package.json) — currently `loglens.loglens-vscode`. Format is `<publisher>.<name>`.
- [ ] **Update `publisher` field** in `package.json` to match your registered publisher name
- [x] **Add an icon** — ✅ Done. SVG source at `docs/assets/logo-mark.svg`, 128×128 PNG auto-generated at `images/icon.png` via `npm run build:icon` (chained into `npm run compile`). Wired into `package.json` as `"icon": "images/icon.png"`.
- [ ] **Add a LICENSE file** at the project root. MIT is recommended:
  ```
  MIT License
  Copyright (c) 2026 <Your Name / Org>
  ...
  ```

---

## 2️⃣ Create accounts (one-time)

- [ ] **Sign up for Azure DevOps** at https://dev.azure.com (free)
- [ ] **Create a Marketplace publisher** at https://marketplace.visualstudio.com/manage
- [ ] **Generate a Personal Access Token (PAT)** at https://dev.azure.com/<your-org>/_usersSettings/tokens
  - Scope: **Marketplace → Manage**
  - Expiration: 1 year (you'll renew before re-publishing later)
  - Save it somewhere safe — you only see it once
- [ ] **Create a GitHub (or GitLab) repo** for the project — set it private or public per your call

---

## 3️⃣ Install publishing tools (one-time, on your machine)

```powershell
npm install -g @vscode/vsce
```

Verify:
```powershell
vsce --version
```

Should print a version number (e.g. `3.2.0`).

---

## 4️⃣ Update placeholders in source

Search-and-replace these in the codebase:

- [ ] `your-org/loglens-vscode` → your real GitHub `<org>/<repo>` path
  - Files: [README.md](README.md), [docs/index.html](docs/index.html), [CHANGELOG.md](CHANGELOG.md)
- [ ] `loglens.loglens-vscode` → your real `<publisher>.<name>`
  - Files: [README.md](README.md), [docs/index.html](docs/index.html)
- [ ] `loglens` publisher field → your registered publisher
  - File: [package.json](package.json)

PowerShell one-liner to find all placeholder remnants:
```powershell
Get-ChildItem -Path . -Recurse -File -Include *.md, *.html, *.json `
  -Exclude package-lock.json `
  | Select-String -Pattern "your-org|loglens\.loglens-vscode" `
  | Select-Object Path, LineNumber, Line
```

---

## 5️⃣ Final code polish

- [ ] **Build cleanly:**
  ```powershell
  npm install
  npm run compile
  ```
  Verify `dist/extension.js` AND `dist/mcp-server.mjs` are both produced.

- [ ] **Run the extension in Extension Development Host** — press `F5` from VS Code

- [ ] **Manual smoke test** in the EDH window:
  1. Open a workspace **without** `.mcp.json` → confirm the "Setup MCP" notification appears
  2. Click Setup → confirm `.mcp.json`, `.vscode/mcp.json`, and `.cursor/mcp.json` are all written
  3. Reload → in Claude Code chat, type `/mcp` → confirm `loglens` is listed with 11 tools
  4. Ask Claude Code: *"Use LogLens to scan this codebase and generate a starter schema"* → confirm files appear in `.loganalysis/`
  5. Verify tree view in the LogLens activity bar populates

- [ ] **Test the JSONC-safety edge case** — create a `.vscode/mcp.json` with `// comments` and a non-loglens entry, run Setup, confirm the existing entry survives

- [ ] **Test self-heal** — manually edit `.mcp.json` to point at a fake path, reload, confirm path is auto-corrected and "upgraded" toast appears

---

## 6️⃣ Verify what's in the package

```powershell
npx @vscode/vsce ls
```

This lists every file that will end up in the `.vsix`. Should include:
- `dist/extension.js`
- `dist/mcp-server.mjs`
- `package.json`
- `README.md`
- `CHANGELOG.md`
- `LICENSE` (after you add it)
- `images/icon.png` (after you add it)

Should **NOT** include:
- `src/` — excluded via `.vscodeignore`
- `node_modules/` (except production deps — vsce includes only those)
- `reference/`
- `docs/`
- `examples/` (already deleted)
- `*.map` source maps

Verify `.vscodeignore` is doing its job:
```powershell
Get-Content .vscodeignore
```

---

## 7️⃣ Generate the .vsix locally

```powershell
npx @vscode/vsce package
```

Produces `loglens-vscode-0.1.0.vsix` (~800 KB expected).

- [ ] **Test-install the local .vsix** in a fresh VS Code:
  ```powershell
  code --install-extension loglens-vscode-0.1.0.vsix
  ```
  Then verify it activates, the status bar shows the LogLens icon, and the Setup command works.

- [ ] **Uninstall and re-install** to verify the upgrade self-heal flow

---

## 8️⃣ Push to GitHub

```powershell
git init
git add .
git commit -m "Initial LogLens release"
git branch -M main
git remote add origin https://github.com/<your-org>/<repo>.git
git push -u origin main

# Tag the release
git tag v0.1.0
git push --tags
```

- [ ] **Verify the GitHub repo** has the README rendered correctly
- [ ] **Enable GitHub Pages** for the docs site:
  - Settings → Pages → Source: Deploy from a branch
  - Branch: `main`, Folder: `/docs`
  - Site live at `https://<your-org>.github.io/<repo>/`
- [ ] **Add a repo description** + topics (e.g. `vscode-extension`, `mcp`, `claude-code`, `log-analysis`)

---

## 9️⃣ Publish to VS Code Marketplace

```powershell
# Login once with your PAT
npx @vscode/vsce login <your-publisher-name>
# Paste the PAT when prompted

# Publish (uses the saved PAT)
npx @vscode/vsce publish
```

- [ ] **Wait 5–10 minutes** for the listing to appear at:
  ```
  https://marketplace.visualstudio.com/items?itemName=<publisher>.loglens-vscode
  ```
- [ ] **Open in VS Code** — search for "LogLens" in Extensions panel; confirm it appears and installs

---

## 🔟 (Optional but recommended) Publish to Open VSX Registry

Cursor and VSCodium users use Open VSX, not the Microsoft Marketplace. To reach them:

- [ ] **Sign in** at https://open-vsx.org with GitHub
- [ ] **Create a namespace** matching your publisher
- [ ] **Generate an Open VSX access token**
- [ ] **Publish:**
  ```powershell
  npx ovsx publish loglens-vscode-0.1.0.vsix -p <open-vsx-token>
  ```

---

## 1️⃣1️⃣ Post-publish

- [ ] **Pin a release announcement** in your team Slack / Discord
- [ ] **Tag relevant subreddits / forums** (r/vscode, r/programming, MCP discord)
- [ ] **Update README + Marketplace listing** if the install URL needs adjusting
- [ ] **Set up GitHub Actions** to auto-publish on tag pushes (so future releases are one command)

A minimal `.github/workflows/publish.yml`:
```yaml
name: Publish
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: 20}
      - run: npm ci
      - run: npm run compile
      - run: npx @vscode/vsce publish -p ${{ secrets.VSCE_PAT }}
      - run: npx ovsx publish -p ${{ secrets.OVSX_PAT }}
```

---

## ⚠️ Common pitfalls

| Problem | Fix |
|---------|-----|
| `vsce publish` fails with "publisher not found" | Run `vsce login <publisher>` first |
| Extension installs but doesn't activate | Check `activationEvents` in `package.json` — currently `onStartupFinished` (good) |
| Status bar icon doesn't show | Confirm `package.json` `main` points at `./dist/extension.js` |
| MCP server fails to spawn for end users | They need Node 18+ on PATH. Mentioned in Requirements but worth a CHANGELOG note |
| Self-heal doesn't trigger after upgrade | The "stale" detection is exact string match. Works correctly; user only sees a toast once per version |
| Icon looks bad | Marketplace expects 128×128 PNG. Test with VS Code dark + light themes |

---

## Quick command reference

| What | Command |
|------|---------|
| Build | `npm run compile` |
| Package locally | `npx @vscode/vsce package` |
| Install local .vsix | `code --install-extension loglens-vscode-0.1.0.vsix` |
| Login to Marketplace | `npx @vscode/vsce login <publisher>` |
| Publish to Marketplace | `npx @vscode/vsce publish` |
| Publish to Open VSX | `npx ovsx publish *.vsix -p <token>` |
| Test in EDH | F5 from VS Code |

---

## Done? Sanity check before clicking publish

- [ ] Built cleanly with no errors
- [ ] Smoke-tested in EDH on a real repo (preferably ccmcti to validate the full schema generation flow)
- [ ] LICENSE file present
- [ ] Icon present
- [ ] README placeholders replaced
- [ ] CHANGELOG entry for v0.1.0 finalized with today's date
- [ ] Repo pushed to GitHub
- [ ] Marketplace publisher exists
- [ ] PAT generated and saved

If all boxes are checked, ship it. 🚀
