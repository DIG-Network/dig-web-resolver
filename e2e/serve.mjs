// A minimal static file server for the Playwright e2e run — serves the repo root so
// a fixture page can load the freshly built `dist/dig-web-resolver.iife.js`.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT ?? 4173);

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
};

// A Service Worker can only register at `scope:"/"` when its script is served from
// the origin ROOT. Map the two root-scoped SW scripts the SW e2e needs onto their
// real files (the built bundle + the success-emulator fixture).
const ROOT_ROUTES = {
  "/dig-sw.js": "dist/dig-sw.js",
  "/success-sw.js": "e2e/fixtures/sw/success-sw.js",
};

createServer(async (req, res) => {
  try {
    const pathname = (req.url ?? "/").split("?")[0];
    const rel = ROOT_ROUTES[pathname] ?? normalize(decodeURIComponent(pathname));
    const file = join(root, rel);
    if (!file.startsWith(root)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    const body = await readFile(file);
    // `Service-Worker-Allowed: /` lets a nested-path script claim the root scope.
    res
      .writeHead(200, {
        "content-type": MIME[extname(file)] ?? "application/octet-stream",
        "service-worker-allowed": "/",
      })
      .end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log(`e2e static server on http://localhost:${port}`));
