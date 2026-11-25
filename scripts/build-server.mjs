// Bundle the HTTP server and the MCP server into server/dist (any OS).
// Run from ui/ through `npm run build:server`: the bundles resolve their
// packages from ui/node_modules, where the dependencies are installed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiModules = path.join(root, "ui", "node_modules");
const esbuild = createRequire(path.join(uiModules, "x.js"))("esbuild");

const common = { bundle: true, platform: "node", format: "cjs", nodePaths: [uiModules], logLevel: "warning" };
await esbuild.build({ ...common, entryPoints: [path.join(root, "server", "main.ts")], outfile: path.join(root, "server", "dist", "server.js") });
await esbuild.build({ ...common, entryPoints: [path.join(root, "server", "mcp", "main.ts")], outfile: path.join(root, "server", "dist", "mcp.js") });
await esbuild.build({ ...common, entryPoints: [path.join(root, "server", "agents", "cli.ts")], outfile: path.join(root, "server", "dist", "connect.js") });
// playwright-core reads its browser revisions from browsers.json next to the bundle.
fs.copyFileSync(path.join(uiModules, "playwright-core", "browsers.json"), path.join(root, "server", "browsers.json"));
console.log("server/dist/server.js, server/dist/mcp.js and server/dist/connect.js built");
