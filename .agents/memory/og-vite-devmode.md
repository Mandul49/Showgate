---
name: OG route vs Vite dev mode
description: Why the /e/:eventId OG meta-tag route must skip in development mode
---

# Rule
In `server/og.ts`, the `/e/:eventId` Express route must call `next()` when `NODE_ENV !== "production"` and never serve raw HTML directly in development.

**Why:** Vite's `transformIndexHtml()` must run on every HTML response in dev mode — it injects the `@vite/client` HMR script, transforms `<script type="module">` paths, and runs plugin hooks. When an Express route reads `client/index.html` directly and calls `res.end(html)`, Vite's middleware never touches the response. React's main entry script loads but the HMR bootstrap is absent, causing a silent blank white page with no console errors (React unmounts without an error boundary).

**How to apply:** Any Express route that returns HTML in dev mode must either:
1. Call `next()` and let Vite's catch-all (`app.use("*")`) handle it with `vite.transformIndexHtml(url, template)`, OR
2. Accept the Vite dev server instance and call `await vite.transformIndexHtml(url, html)` before sending.

In production there is no Vite — the built `server/public/index.html` can be read and served directly by any route.
