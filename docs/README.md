# LogLens Documentation Site

Static single-page site for LogLens. Built with Tailwind (CDN) + vanilla HTML. No build step.

## Local preview

Just open `index.html` in any browser:

```powershell
start docs/index.html
```

Or serve it locally for a more accurate environment:

```bash
# Python
python -m http.server 8080 --directory docs

# Node (one-liner)
npx serve docs
```

## Deploying

### GitHub Pages

1. Push this `docs/` folder to your GitHub repo
2. Repo Settings → Pages → Source: **Deploy from a branch**
3. Branch: `main` · Folder: `/docs` · Save
4. Site live at `https://<user>.github.io/<repo>/`

### Other hosts (Netlify, Vercel, Cloudflare Pages)

Point the host at the `docs/` directory. No build command needed — it's pure static HTML.

## Before publishing — replace these placeholders

The HTML contains a few placeholders to update:

- `vikram9410/loglens` → your actual GitHub org/repo
- `vikram.loglens-vscode` → your Marketplace publisher.extension ID

Search-and-replace across `index.html` once you have your real handles.

## Structure

```
docs/
├── index.html       ← single-page site (all content)
├── _config.yml      ← GitHub Pages config
└── README.md        ← this file
```

No dependencies, no build pipeline, no node_modules. Pure HTML + Tailwind via CDN.
