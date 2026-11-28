// Blum Studio: gallery + editor pages plus a small JSON API for them.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { closeBrowser } from "./export/browser.js";
import { fail, mimeFor, postAllowed, sendFile } from "./http.js";
import { assetsDir, loadDotEnv, mediaDir, uiDir } from "./paths.js";
import { migrateLegacyKeys } from "./stock.js";
import { createRoute, deleteRoute, duplicateRoute, getRoute, listRoute, mtimeRoute, renameRoute, stateRoute, usageRoute } from "./routes/designs.js";
import { exportRoute, pdfRoute, pngRoute } from "./routes/export.js";
import { mediaRoute, uploadRoute } from "./routes/media.js";
import { checkRoute, opsRoute, redoRoute, syncRoute, undoRoute } from "./routes/ops.js";
import { resourcesRoute } from "./routes/resources.js";
import { agentConnectRoute, agentDisconnectRoute, agentsRoute } from "./routes/agents.js";
import { stockRoute, stockSaveRoute } from "./routes/stock.js";
import { cachedAgents } from "./agents/index.js";
import {
  consoleAgentsRoute,
  consoleDeleteRoute,
  consoleGetRoute,
  consoleListRoute,
  consoleRenameRoute,
} from "./routes/console/sessions.js";
import {
  consoleCreateRoute,
  consoleMessageRoute,
  consoleStopRoute,
  consoleStreamRoute,
} from "./routes/console/runs.js";
import { consoleUploadRoute } from "./routes/console/uploads.js";
import { designsDir } from "./paths.js";

const STATIC: Array<[string, () => string, boolean?]> = [
  ["/js/", () => path.join(uiDir(), "dist")],
  ["/css/", () => path.join(uiDir(), "gallery")],
  ["/render/", () => path.join(uiDir(), "render")],
  ["/assets/", () => assetsDir()],
  ["/media/", () => mediaDir()],
  ["/editor/", () => path.join(uiDir(), "editor"), true],
];

function serveStatic(pathname: string, res: ServerResponse): boolean {
  for (const [prefix, dirFn, html] of STATIC) {
    if (!pathname.startsWith(prefix)) continue;
    const dir = dirFn();
    let rel = decodeURIComponent(pathname.slice(prefix.length));
    if (rel.includes("..") || rel.includes("\0")) {
      fail(res, 404, "not found");
      return true;
    }
    let file = path.join(dir, rel);
    try {
      if (fs.statSync(file).isDirectory()) {
        if (!html) {
          fail(res, 404, "not found");
          return true;
        }
        file = path.join(file, "index.html");
      }
    } catch {
      fail(res, 404, "not found");
      return true;
    }
    if (!fs.existsSync(file)) {
      fail(res, 404, "not found");
      return true;
    }
    sendFile(res, file, mimeFor(file));
    return true;
  }
  return false;
}

const API: Array<{ method: string; match: RegExp; run: (req: IncomingMessage, res: ServerResponse, m: RegExpMatchArray) => Promise<void> }> = [
  { method: "GET", match: /^\/api\/designs$/, run: (q, s) => listRoute(q, s) },
  { method: "POST", match: /^\/api\/designs$/, run: async (q, s) => createRoute(q, s) },
  { method: "GET", match: /^\/api\/designs\/([^/]+)$/, run: (q, s, m) => getRoute(q, s, decodeURIComponent(m[1])) },
  { method: "DELETE", match: /^\/api\/designs\/([^/]+)$/, run: (q, s, m) => deleteRoute(q, s, decodeURIComponent(m[1])) },
  { method: "PUT", match: /^\/api\/designs\/([^/]+)$/, run: async (q, s, m) => renameRoute(q, s, decodeURIComponent(m[1])) },
  { method: "GET", match: /^\/api\/designs\/([^/]+)\/state$/, run: (q, s, m) => stateRoute(q, s, decodeURIComponent(m[1])) },
  { method: "GET", match: /^\/api\/designs\/([^/]+)\/mtime$/, run: (q, s, m) => mtimeRoute(q, s, decodeURIComponent(m[1])) },
  { method: "GET", match: /^\/api\/designs\/([^/]+)\/usage$/, run: (q, s, m) => usageRoute(q, s, decodeURIComponent(m[1])) },
  { method: "POST", match: /^\/api\/designs\/([^/]+)\/ops$/, run: (q, s, m) => opsRoute(q, s, decodeURIComponent(m[1])) },
  { method: "POST", match: /^\/api\/designs\/([^/]+)\/undo$/, run: (q, s, m) => undoRoute(q, s, decodeURIComponent(m[1])) },
  { method: "POST", match: /^\/api\/designs\/([^/]+)\/redo$/, run: (q, s, m) => redoRoute(q, s, decodeURIComponent(m[1])) },
  { method: "POST", match: /^\/api\/designs\/([^/]+)\/sync$/, run: (q, s, m) => syncRoute(q, s, decodeURIComponent(m[1])) },
  { method: "GET", match: /^\/api\/designs\/([^/]+)\/check$/, run: (q, s, m) => checkRoute(q, s, decodeURIComponent(m[1])) },
  { method: "GET", match: /^\/api\/resources$/, run: (q, s) => resourcesRoute(q, s) },
  { method: "POST", match: /^\/api\/designs\/([^/]+)\/media$/, run: (q, s, m) => uploadRoute(q, s, decodeURIComponent(m[1])) },
  { method: "POST", match: /^\/api\/designs\/([^/]+)\/export$/, run: (q, s, m) => exportRoute(q, s, decodeURIComponent(m[1])) },
  { method: "GET", match: /^\/api\/designs\/([^/]+)\/png$/, run: (q, s, m) => pngRoute(q, s, decodeURIComponent(m[1])) },
  { method: "GET", match: /^\/api\/designs\/([^/]+)\/pdf$/, run: (q, s, m) => pdfRoute(q, s, decodeURIComponent(m[1])) },
  { method: "POST", match: /^\/api\/designs\/([^/]+)\/duplicate$/, run: async (q, s, m) => duplicateRoute(q, s, decodeURIComponent(m[1])) },
  { method: "GET", match: /^\/api\/media\/([^/]+)$/, run: (q, s, m) => mediaRoute(q, s, decodeURIComponent(m[1])) },
  { method: "GET", match: /^\/api\/agents$/, run: (q, s) => agentsRoute(q, s) },
  { method: "GET", match: /^\/api\/stock$/, run: (q, s) => stockRoute(q, s) },
  { method: "POST", match: /^\/api\/stock$/, run: async (q, s) => stockSaveRoute(q, s) },
  { method: "POST", match: /^\/api\/agents\/([^/]+)\/connect$/, run: (q, s, m) => agentConnectRoute(q, s, decodeURIComponent(m[1])) },
  { method: "POST", match: /^\/api\/agents\/([^/]+)\/disconnect$/, run: (q, s, m) => agentDisconnectRoute(q, s, decodeURIComponent(m[1])) },
  { method: "GET", match: /^\/api\/console\/agents$/, run: (q, s) => consoleAgentsRoute(q, s) },
  { method: "GET", match: /^\/api\/console\/sessions$/, run: (q, s) => consoleListRoute(q, s) },
  { method: "POST", match: /^\/api\/console\/sessions$/, run: async (q, s) => consoleCreateRoute(q, s) },
  { method: "POST", match: /^\/api\/console\/uploads$/, run: (q, s) => consoleUploadRoute(q, s) },
  { method: "GET", match: /^\/api\/console\/sessions\/([^/]+)$/, run: (q, s, m) => consoleGetRoute(q, s, decodeURIComponent(m[1])) },
  { method: "POST", match: /^\/api\/console\/sessions\/([^/]+)\/message$/, run: async (q, s, m) => consoleMessageRoute(q, s, decodeURIComponent(m[1])) },
  { method: "POST", match: /^\/api\/console\/sessions\/([^/]+)\/stop$/, run: (q, s, m) => consoleStopRoute(q, s, decodeURIComponent(m[1])) },
  { method: "POST", match: /^\/api\/console\/sessions\/([^/]+)\/stream$/, run: (q, s, m) => consoleStreamRoute(q, s, decodeURIComponent(m[1])) },
  { method: "POST", match: /^\/api\/console\/sessions\/([^/]+)\/rename$/, run: async (q, s, m) => consoleRenameRoute(q, s, decodeURIComponent(m[1])) },
  { method: "POST", match: /^\/api\/console\/sessions\/([^/]+)\/delete$/, run: (q, s, m) => consoleDeleteRoute(q, s, decodeURIComponent(m[1])) },
];

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const raw = req.url ?? "/";
  const pathname = raw.split("?")[0];
  try {
    if (req.method === "GET" && pathname === "/") {
      sendFile(res, path.join(uiDir(), "gallery", "create.html"), "text/html; charset=utf-8");
      return;
    }
    if (req.method === "GET" && pathname === "/designs") {
      sendFile(res, path.join(uiDir(), "gallery", "designs.html"), "text/html; charset=utf-8");
      return;
    }
    if (req.method === "GET" && pathname.startsWith("/create/")) {
      sendFile(res, path.join(uiDir(), "gallery", "session.html"), "text/html; charset=utf-8");
      return;
    }
    if (req.method === "GET" && pathname === "/resources") {
      sendFile(res, path.join(uiDir(), "gallery", "resources.html"), "text/html; charset=utf-8");
      return;
    }
    if (req.method === "GET" && pathname === "/getting-started") {
      sendFile(res, path.join(uiDir(), "gallery", "getting-started.html"), "text/html; charset=utf-8");
      return;
    }
    if (req.method === "GET" && pathname === "/settings") {
      sendFile(res, path.join(uiDir(), "gallery", "settings.html"), "text/html; charset=utf-8");
      return;
    }
    if (req.method === "GET" && pathname === "/studio") {
      res.writeHead(307, { location: "/editor/" });
      res.end();
      return;
    }
    // Every state-changing API call needs the local-app guard: a web page on
    // another origin can send a "simple" POST with no preflight, but it can
    // never add the custom header this check requires.
    if (pathname.startsWith("/api/") && req.method !== "GET" && !postAllowed(req)) {
      fail(res, 403, "forbidden: write from the local app only");
      return;
    }
    for (const route of API) {
      if (req.method !== route.method) continue;
      const m = route.match.exec(pathname);
      if (!m) continue;
      await route.run(req, res, m);
      return;
    }
    if (req.method === "GET" && serveStatic(pathname, res)) return;
    fail(res, 404, "not found");
  } catch (e) {
    if (!res.headersSent) fail(res, 500, (e as Error).message);
    else res.end();
  }
}

export function start(port: number): ReturnType<typeof createServer> {
  fs.mkdirSync(designsDir(), { recursive: true });
  fs.mkdirSync(mediaDir(), { recursive: true });
  const server = createServer((req, res) => {
    void handle(req, res);
  });
  server.listen(port, "127.0.0.1");
  const shutdown = (): void => {
    server.close(() => {
      void closeBrowser().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // Node exits silently on a stray rejection (a design lock chain, a Chromium
  // crash mid-export): log it and keep serving the editor instead.
  // shortcut: keeps running after an uncaught exception too; restart by hand if the log shows repeats.
  process.on("unhandledRejection", (e) => console.error("[blum] unhandled rejection:", e));
  process.on("uncaughtException", (e) => console.error("[blum] uncaught exception:", e));
  return server;
}

if (process.argv[1]?.endsWith("server.js") || process.argv[1]?.endsWith("main.js")) {
  loadDotEnv();
  void migrateLegacyKeys();
  const port = Number(process.env.BLUM_PORT ?? "8092") || 8092;
  start(port);
  // Probe the agents in the background so Settings opens instantly.
  void cachedAgents().catch(() => undefined);
  // eslint-disable-next-line no-console
  console.log(`Blum Studio on http://127.0.0.1:${port}/ designs=${designsDir()}`);
}
