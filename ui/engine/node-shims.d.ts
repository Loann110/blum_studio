// Minimal ambient declarations for the Node builtins the engine test
// uses, so the test compiles without @types/node (no new dependency).
declare module 'node:test' {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void): void;
}

declare module 'node:assert/strict' {
  const assert: {
    ok(value: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
  };
  export default assert;
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string;
}
