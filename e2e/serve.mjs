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

createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0]));
    const file = join(root, path);
    if (!file.startsWith(root)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log(`e2e static server on http://localhost:${port}`));
