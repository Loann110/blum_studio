// The studio version, from a single place: the root package.json.
// The MCP server and the store User-Agent read it from here; the end-to-end
// check compares the announced version against the same file.
import fs from "node:fs";
import path from "node:path";
import { root } from "./paths.js";

export function studioVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root(), "package.json"), "utf-8")) as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version.length > 0) return pkg.version;
  } catch {
    // No readable package.json (a temp BLUM_ROOT in tests): use the release version.
  }
  return "0.0.1";
}
