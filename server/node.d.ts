// Minimal ambient Node declarations for the server typecheck only.
// Covers exactly the Node surface server/ uses. Prefer "@types/node" as a
// devDependency when the user approves a new dependency; until then this
// keeps `tsc -p server/tsconfig.json` meaningful without one.
declare module "node:http" {
  export interface IncomingMessage {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    on(event: "data", fn: (chunk: Buffer) => void): void;
    on(event: "end" | "error" | "close", fn: (arg?: unknown) => void): void;
    destroy(): void;
  }
  export interface ServerResponse {
    headersSent: boolean;
    writeHead(status: number, headers?: Record<string, string>): void;
    write(chunk: string): void;
    end(data?: unknown): void;
  }
  export interface Server {
    listen(port: number, host?: string): void;
    close(done?: () => void): void;
    address(): { port: number } | string | null;
  }
  export function createServer(
    handler: (req: IncomingMessage, res: ServerResponse) => void,
  ): Server;
}

declare module "node:fs" {
  export function existsSync(p: string): boolean;
  export function readFileSync(p: string, enc: "utf-8"): string;
  export function readFileSync(p: string): Buffer;
  export function writeFileSync(p: string, data: string | Buffer, enc?: "utf-8"): void;
  export function unlinkSync(p: string): void;
  export function mkdirSync(p: string, opts?: { recursive?: boolean }): void;
  export function statSync(p: string): { mtimeMs: number; size: number; isDirectory(): boolean; isFile(): boolean };
  export function mkdtempSync(prefix: string): string;
  export function rmSync(p: string, opts?: { recursive?: boolean; force?: boolean }): void;
  export function readdirSync(p: string): string[];
  export function renameSync(a: string, b: string): void;
  export interface ReadStream {
    pipe<T>(dest: T): T;
  }
  export function createReadStream(p: string): ReadStream;
  export namespace promises {
    export function rename(a: string, b: string): Promise<void>;
    export function mkdir(p: string, opts?: { recursive?: boolean }): Promise<void>;
    export function writeFile(p: string, data: string | Buffer, enc?: "utf-8"): Promise<void>;
    export function unlink(p: string): Promise<void>;
  }
  const fs: {
    existsSync: typeof existsSync;
    readFileSync: typeof readFileSync;
    writeFileSync: typeof writeFileSync;
    unlinkSync: typeof unlinkSync;
    mkdirSync: typeof mkdirSync;
    statSync: typeof statSync;
    readdirSync: typeof readdirSync;
    renameSync: typeof renameSync;
    mkdtempSync: typeof mkdtempSync;
    rmSync: typeof rmSync;
    createReadStream: typeof createReadStream;
    promises: typeof promises;
  };
  export default fs;
}

declare module "node:path" {
  export function resolve(...parts: string[]): string;
  export function join(...parts: string[]): string;
  export function basename(p: string, ext?: string): string;
  export function dirname(p: string): string;
  export function extname(p: string): string;
  export const sep: string;
  export const delimiter: string;
  const path: {
    resolve: typeof resolve;
    join: typeof join;
    basename: typeof basename;
    dirname: typeof dirname;
    extname: typeof extname;
    sep: string;
    delimiter: string;
  };
  export default path;
}

declare module "node:os" {
  export function tmpdir(): string;
  export function homedir(): string;
  export function platform(): string;
}

declare module "node:crypto" {
  export function randomBytes(n: number): Buffer;
}

declare module "node:child_process" {
  export function execSync(cmd: string, opts?: { timeout?: number }): Buffer;
  export interface SpawnStdio {
    on(event: "data", fn: (chunk: Buffer) => void): void;
  }
  export interface ChildProcess {
    pid?: number;
    stdout?: SpawnStdio | null;
    stderr?: SpawnStdio | null;
    on(event: "error", fn: (e: Error) => void): void;
    on(event: "close", fn: (code: number | null) => void): void;
  }
  export function spawn(
    file: string,
    args: string[],
    opts?: {
      cwd?: string;
      env?: Record<string, string | undefined>;
      stdio?: Array<"ignore" | "pipe"> | "ignore" | "inherit";
      detached?: boolean;
      windowsHide?: boolean;
    },
  ): ChildProcess;
  export interface SpawnSyncResult {
    status: number | null;
  }
  export function spawnSync(
    file: string,
    args: string[],
    opts?: { stdio?: "inherit" | "pipe" | "ignore" },
  ): SpawnSyncResult;
  export interface ExecFileError extends Error {
    code?: string | number | null;
    killed?: boolean;
    signal?: string | null;
  }
  export function execFile(
    file: string,
    args: string[],
    opts: { timeout?: number; encoding: "utf8" },
    done: (error: ExecFileError | null, stdout: string, stderr: string) => void,
  ): void;
}

declare module "node:test" {
  export interface TestContext {
    test(name: string, fn: (t: TestContext) => void | Promise<void>): Promise<void>;
  }
  export default function test(name: string, fn: (t: TestContext) => void | Promise<void>): Promise<void>;
  export function after(fn: () => void | Promise<void>): void;
}

declare module "node:assert/strict" {
  export function ok(value: unknown, message?: string): void;
  export function equal(actual: unknown, expected: unknown, message?: string): void;
  export function notEqual(actual: unknown, expected: unknown, message?: string): void;
  export function deepEqual(actual: unknown, expected: unknown, message?: string): void;
  export function match(value: string, re: RegExp, message?: string): void;
  export function doesNotMatch(value: string, re: RegExp, message?: string): void;
  export function throws(fn: () => unknown, expected?: unknown, message?: string): void;
  export function rejects(fn: Promise<unknown> | (() => Promise<unknown>), expected?: unknown, message?: string): Promise<void>;
  const assert: {
    (value: unknown, message?: string): void;
    ok: typeof ok;
    equal: typeof equal;
    notEqual: typeof notEqual;
    deepEqual: typeof deepEqual;
    match: typeof match;
    doesNotMatch: typeof doesNotMatch;
    throws: typeof throws;
    rejects: typeof rejects;
  };
  export default assert;
}

declare namespace NodeJS {
  interface ErrnoException extends Error {
    code?: string;
  }
}

declare var process: {
  argv: string[];
  env: Record<string, string | undefined>;
  pid: number;
  cwd(): string;
  execPath: string;
  platform: string;
  kill(pid: number, signal?: string): void;
  exit(code?: number): never;
  on(event: "exit" | "SIGINT" | "SIGTERM", fn: () => void): void;
  on(event: "unhandledRejection" | "uncaughtException", fn: (reason: unknown) => void): void;
};

declare class Buffer extends Uint8Array {
  static from(data: ArrayLike<number> | string, encoding?: string): Buffer;
  static from(data: ArrayBuffer, byteOffset?: number, length?: number): Buffer;
  static concat(list: Buffer[]): Buffer;
  static alloc(size: number): Buffer;
  static isBuffer(v: unknown): boolean;
  toString(encoding?: string, start?: number, end?: number): string;
  readUInt32BE(offset: number): number;
  subarray(start?: number, end?: number): Buffer;
  equals(other: Uint8Array): boolean;
  includes(search: string | number | Uint8Array, byteOffset?: number, encoding?: string): boolean;
  indexOf(search: string | number | Uint8Array, byteOffset?: number, encoding?: string): number;
  write(s: string): void;
}
