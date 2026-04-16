# CurisData Static Site

This scaffold is intentionally shaped more like `spaitialintel`:

- main landing pages live at the repo root
- Cloudflare Pages Functions live in `functions/`
- supporting static folders like `images/` and `legal/` sit beside the homepage
- no framework build step is required

## Recommended Structure

```text
.
|-- functions/
|   `-- api/
|       `-- health.js
|-- images/
|   `-- .gitkeep
|-- legal/
|   |-- privacy.html
|   `-- terms.html
|-- .dev.vars.example
|-- .gitignore
|-- 404.html
|-- _headers
|-- index.html
|-- package.json
|-- README.md
|-- script.js
|-- style.css
`-- wrangler.toml
```

## Why This Matches Better

`spaitialintel` uses a flat repo-root static site layout instead of a nested `public/` directory. That keeps deployment simple in Cloudflare Pages and makes it easy to add new standalone HTML pages later.

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start local Pages development:

   ```bash
   npm run dev
   ```

3. Visit the local URL Wrangler prints.

The homepage is served from `index.html` and the sample API route is available at `/api/health`.

## Cloudflare Pages Deployment

Create a GitHub repository, push this project, and connect it to Cloudflare Pages with:

- Framework preset: `None`
- Build command: leave blank
- Build output directory: `.`
- Root directory: `/`

Cloudflare Pages will deploy the root static files and pick up `functions/` automatically.

## Environment Variables

Use `.dev.vars.example` as a local template if you later need secrets or runtime configuration for Pages Functions.

## GitHub Setup

```bash
git add .
git commit -m "Initial static site scaffold"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```
