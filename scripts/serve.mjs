import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".xml": "application/xml",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".pdf": "application/pdf",
};
export function createServer(port = Number(process.env.PORT) || 4173) {
  return http
    .createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://localhost"),
          requested = decodeURIComponent(url.pathname);
        let file = path.resolve(root, "." + requested);
        if (file !== root && !file.startsWith(root + path.sep)) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }
        if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
        const bytes = await readFile(file);
        res.writeHead(200, {
          "Content-Type": types[path.extname(file)] || "application/octet-stream",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(bytes);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    })
    .listen(port, "127.0.0.1");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer();
  console.log("Open http://127.0.0.1:" + (Number(process.env.PORT) || 4173));
}
