// Engine failure: EngineError and fail.
/* ---- error ---- */

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}

export function fail(message: string): never {
  throw new EngineError(message);
}