import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Express, Request, Response } from "express";
import { storage } from "./storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildOgTags(opts: {
  title: string;
  description: string;
  imageUrl: string | null;
  pageUrl: string;
}): string {
  const t = escapeHtml(opts.title);
  const d = escapeHtml(opts.description);
  const u = escapeHtml(opts.pageUrl);
  const img = opts.imageUrl ? escapeHtml(opts.imageUrl) : "";

  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${u}" />`,
    img ? `<meta property="og:image" content="${img}" />` : "",
    `<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    img ? `<meta name="twitter:image" content="${img}" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");
}

async function getIndexHtml(): Promise<string> {
  // In production the built files live at server/public/index.html
  const prodPath = path.resolve(__dirname, "public", "index.html");
  if (fs.existsSync(prodPath)) {
    return fs.promises.readFile(prodPath, "utf-8");
  }
  // In development read the source template directly
  const devPath = path.resolve(__dirname, "..", "client", "index.html");
  return fs.promises.readFile(devPath, "utf-8");
}

function injectOgTags(html: string, tags: string): string {
  // Remove any existing <title> tag the template may have
  html = html.replace(/<title>[^<]*<\/title>\s*/gi, "");
  // Inject our tags right after <head>
  return html.replace(/(<head[^>]*>)/i, `$1\n    ${tags}`);
}

export function registerOgRoutes(app: Express): void {
  app.get("/e/:eventId", async (req: Request, res: Response, next) => {
    // In development Vite's middleware must transform index.html (HMR injection,
    // module path transforms, etc.). Skip OG injection here and let Vite's
    // catch-all handle the request; the client-side useEffect sets OG tags.
    if (process.env.NODE_ENV !== "production") {
      return next();
    }

    try {
      const event = await storage.getEventById(req.params.eventId);

      if (!event) {
        // Let React handle the 404 case
        return next();
      }

      const protocol = req.headers["x-forwarded-proto"] ?? req.protocol;
      const host = req.headers["x-forwarded-host"] ?? req.get("host") ?? "";
      const pageUrl = `${protocol}://${host}/e/${event.id}`;

      const description = event.description?.trim()
        ? event.description.trim()
        : "Get your tickets now";

      const tags = buildOgTags({
        title: `${event.title} — Tickets`,
        description,
        imageUrl: event.coverImageUrl ?? null,
        pageUrl,
      });

      const template = await getIndexHtml();
      const html = injectOgTags(template, tags);

      res.status(200).set({ "Content-Type": "text/html", "Cache-Control": "no-cache" }).end(html);
    } catch (err) {
      next(err);
    }
  });
}
