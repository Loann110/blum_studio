// JSON MCP config files (Claude Desktop, Cursor): find them, merge or remove
// our entry. A backup copy (.bak) is written before every change; an
// unreadable file is never overwritten, so the user cannot lose their other servers.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { root } from "../paths.js";

// Our MCP server name: the key in these files and the name the CLI adapters register.
export const SERVER_NAME = "blum-studio";

export function desktopFile(): string {
  const dir =
    os.platform() === "win32" ? path.join(process.env.APPDATA ?? "", "Claude")
    : os.platform() === "darwin" ? path.join(os.homedir(), "Library", "Application Support", "Claude")
    : path.join(os.homedir(), ".config", "Claude");
  return path.join(dir, "claude_desktop_config.json");
}

export function cursorFile(): string {
  return path.join(os.homedir(), ".cursor", "mcp.json");
}

// The app is installed when the folder that holds its config exists.
export function appInstalled(file: string): boolean {
  try {
    return fs.statSync(path.dirname(file)).isDirectory();
  } catch {
    return false;
  }
}

interface McpConfig {
  mcpServers?: Record<string, { command: string; args: string[]; env: Record<string, string> }>;
  [key: string]: unknown;
}

function readConfig(file: string): McpConfig {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as McpConfig;
  } catch {
    throw new Error(`${file} is not valid JSON, left untouched.`);
  }
}

function serverEntry(): { command: string; args: string[]; env: Record<string, string> } {
  const blumRoot = root();
  return { command: "node", args: [path.join(blumRoot, "server", "dist", "mcp.js")], env: { BLUM_ROOT: blumRoot } };
}

export function configConnected(file: string): boolean {
  if (!appInstalled(file)) return false;
  return readConfig(file).mcpServers?.[SERVER_NAME] !== undefined;
}

// Merge our entry, keeping every other server. Throws when the app is not installed.
export function configConnect(file: string, app: string): void {
  if (!appInstalled(file)) throw new Error(`${app} is not installed.`);
  const config = readConfig(file);
  config.mcpServers = { ...(config.mcpServers ?? {}), [SERVER_NAME]: serverEntry() };
  if (fs.existsSync(file)) fs.writeFileSync(`${file}.bak`, fs.readFileSync(file));
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

// Remove our entry, keeping every other server. A missing file is a no-op.
export function configDisconnect(file: string, app: string): void {
  if (!appInstalled(file)) throw new Error(`${app} is not installed.`);
  if (!fs.existsSync(file)) return;
  const config = readConfig(file);
  if (config.mcpServers?.[SERVER_NAME] === undefined) return;
  delete config.mcpServers[SERVER_NAME];
  fs.writeFileSync(`${file}.bak`, fs.readFileSync(file));
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}
