import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("public");
const port = Number(process.env.VIDEO_PORT || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
};

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "POST" && url.pathname === "/save") {
      const name = path.basename(url.searchParams.get("name") || "");
      if (!/^fivem-devmgr-teaser-vertical\.[a-z0-9]+$/i.test(name)) {
        return json(res, 400, { ok: false, error: "Nom de fichier refusé." });
      }

      const maxBytes = 200 * 1024 * 1024;
      const chunks = [];
      let size = 0;

      for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBytes) {
          return json(res, 413, { ok: false, error: "Fichier trop lourd." });
        }
        chunks.push(chunk);
      }

      if (size === 0) {
        return json(res, 400, { ok: false, error: "Fichier vide." });
      }

      const target = path.join(root, "video", name);
      await writeFile(target, Buffer.concat(chunks));
      console.log(`[teaser] saved ${name} (${size} bytes)`);
      return json(res, 200, { ok: true, name, size, path: `public/video/${name}` });
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return json(res, 405, { ok: false, error: "Méthode non autorisée." });
    }

    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/video/fivem-devmgr-teaser-vertical.html";

    const file = path.resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
      return json(res, 403, { ok: false, error: "Chemin refusé." });
    }

    const data = await readFile(file);
    const contentType = mime[path.extname(file).toLowerCase()] || "application/octet-stream";
    const range = req.headers.range;
    const match = typeof range === "string" ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;

    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), data.length - 1) : data.length - 1;
      if (start > end || start >= data.length) {
        res.writeHead(416, { "Content-Range": `bytes */${data.length}` });
        return res.end();
      }
      res.writeHead(206, {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${data.length}`,
        "Content-Length": end - start + 1,
        "Access-Control-Allow-Origin": "*",
      });
      return res.end(req.method === "HEAD" ? undefined : data.subarray(start, end + 1));
    }

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Accept-Ranges": "bytes",
      "Content-Length": data.length,
      "Access-Control-Allow-Origin": "*",
    });
    if (req.method === "HEAD") res.end();
    else res.end(data);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return json(res, 404, { ok: false, error: "Fichier introuvable." });
    }
    console.error("[teaser] error", error);
    return json(res, 500, { ok: false, error: "Erreur serveur." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[teaser] video studio on http://127.0.0.1:${port}`);
});
