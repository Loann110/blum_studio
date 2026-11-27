// Safe download: SSRF guard (DNS pinning, manual redirects, size cap).
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { studioVersion } from "./version.js";

export const MAX_IMAGE_BYTES = 25_000_000;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 30_000;

// Every non-public range: a design URL must never reach these.
const blocked = new net.BlockList();
blocked.addSubnet("127.0.0.0", 8, "ipv4");
blocked.addSubnet("10.0.0.0", 8, "ipv4");
blocked.addSubnet("172.16.0.0", 12, "ipv4");
blocked.addSubnet("192.168.0.0", 16, "ipv4");
blocked.addSubnet("169.254.0.0", 16, "ipv4");
blocked.addSubnet("100.64.0.0", 10, "ipv4");
blocked.addSubnet("0.0.0.0", 8, "ipv4");
blocked.addSubnet("224.0.0.0", 4, "ipv4");
blocked.addSubnet("::1", 128, "ipv6");
blocked.addSubnet("::", 128, "ipv6");
blocked.addSubnet("fe80::", 10, "ipv6");
blocked.addSubnet("fc00::", 7, "ipv6");
blocked.addSubnet("ff00::", 8, "ipv6");

// The IPv4 inside a mapped address: ::ffff:1.2.3.4 hides a private range.
function mappedV4(ip: string): string | null {
  if (ip.includes(".")) {
    const tail = ip.slice(ip.lastIndexOf(":") + 1);
    return net.isIP(tail) === 4 ? tail : null;
  }
  const parts = ip.toLowerCase().split(":");
  if (parts.length < 3) return null;
  const hi = parts[parts.length - 2];
  const lo = parts[parts.length - 1];
  if (!/^[0-9a-f]{1,4}$/.test(hi) || !/^[0-9a-f]{1,4}$/.test(lo)) return null;
  if (parts[parts.length - 3] !== "ffff") return null;
  for (let i = 0; i < parts.length - 3; i++) {
    if (parts[i] !== "" && parts[i] !== "0") return null;
  }
  const n = (parseInt(hi, 16) << 16) | parseInt(lo, 16);
  return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

export function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return blocked.check(ip, "ipv4");
  if (family === 6) {
    if (blocked.check(ip, "ipv6")) return true;
    const v4 = mappedV4(ip);
    return v4 !== null && blocked.check(v4, "ipv4");
  }
  return true;
}

export type LookupFn = (host: string) => Promise<Array<{ address: string; family: number }>>;
export type ResolveFn = (host: string) => Promise<string[]>;

const systemLookup: LookupFn = (host) => dns.promises.lookup(host, { all: true });

// All addresses must be public: one private record poisons the host.
export async function resolvePublicAddresses(host: string, lookup: LookupFn = systemLookup): Promise<string[]> {
  const clean = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (net.isIP(clean)) {
    if (isBlockedIp(clean)) throw new Error(`refused: private address ${clean}`);
    return [clean];
  }
  let recs: Array<{ address: string; family: number }>;
  try {
    recs = await lookup(clean);
  } catch (e) {
    throw new Error(`could not resolve '${clean}': ${(e as Error).message}`);
  }
  if (!recs.length) throw new Error(`could not resolve '${clean}'`);
  for (const r of recs) {
    if (isBlockedIp(r.address)) throw new Error(`refused: private address ${r.address} for '${clean}'`);
  }
  return recs.map((r) => r.address);
}

// Pin the socket to the checked address: DNS cannot swap it mid-connect.
function pinnedLookup(pinned: string): (hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => void {
  const family = net.isIP(pinned);
  return (_hostname, options, callback) => {
    if (options?.all) callback(null, [{ address: pinned, family }]);
    else callback(null, pinned, family);
  };
}

function header(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function oneHop(url: URL, pinned: string, msLeft: number): Promise<{ redirect?: string; body?: Buffer }> {
  return new Promise((done, fail) => {
    let settled = false;
    const ok = (v: { redirect?: string; body?: Buffer }): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done(v);
    };
    const bad = (e: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fail(e);
    };
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { "User-Agent": `blum-studio/${studioVersion()}` },
        lookup: pinnedLookup(pinned),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = header(res.headers["location"]);
        if ((status === 301 || status === 302 || status === 303 || status === 307 || status === 308) && location) {
          res.destroy();
          ok({ redirect: location });
          return;
        }
        if (status < 200 || status > 299) {
          res.destroy();
          bad(new Error(`HTTP ${status}`));
          return;
        }
        const len = Number(header(res.headers["content-length"]));
        if (Number.isFinite(len) && len > MAX_IMAGE_BYTES) {
          res.destroy();
          bad(new Error("image is larger than 25 MB"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_IMAGE_BYTES) {
            res.destroy();
            bad(new Error("image is larger than 25 MB"));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => ok({ body: Buffer.concat(chunks) }));
        res.on("error", (e: unknown) => bad(e as Error));
      },
    );
    req.on("error", (e: Error) => bad(e));
    const timer = setTimeout(() => {
      req.destroy(new Error("timed out after 30 s"));
    }, Math.max(1, msLeft));
    req.end();
  });
}

// Remote bytes with the destination re-checked at every redirect hop.
export async function downloadImage(url: string, resolve: ResolveFn = resolvePublicAddresses): Promise<Buffer> {
  const started = Date.now();
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      throw new Error(`refused: bad URL '${current.slice(0, 80)}'`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`refused: scheme '${parsed.protocol}' is not allowed (http/https only)`);
    }
    const left = TIMEOUT_MS - (Date.now() - started);
    if (left <= 0) throw new Error("timed out after 30 s");
    const addrs = await resolve(parsed.hostname);
    if (!addrs.length) throw new Error(`could not resolve '${parsed.hostname}'`);
    const res = await oneHop(parsed, addrs[0], left);
    if (res.redirect === undefined) return res.body as Buffer;
    if (hop === MAX_REDIRECTS) throw new Error(`too many redirects (at most ${MAX_REDIRECTS})`);
    try {
      current = new URL(res.redirect, parsed).toString();
    } catch {
      throw new Error(`refused: bad redirect '${res.redirect.slice(0, 80)}'`);
    }
  }
  throw new Error(`too many redirects (at most ${MAX_REDIRECTS})`);
}
