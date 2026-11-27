// Stock photos over HTTP: status of the two key slots, and set/remove a key.
import type { IncomingMessage, ServerResponse } from "node:http";
import { fail, readJson, sendJson } from "../http.js";
import { probeStock, setStockKey, stockStatus, STOCK_SERVICES, type StockService } from "../stock.js";

export async function stockRoute(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  sendJson(res, 200, stockStatus());
}

export async function stockSaveRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: unknown;
  try {
    body = await readJson(req);
  } catch (e) {
    fail(res, 400, (e as Error).message);
    return;
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const service = b.service;
  if (typeof service !== "string" || !(STOCK_SERVICES as readonly string[]).includes(service)) {
    fail(res, 400, "service must be pexels|pixabay");
    return;
  }
  const key = typeof b.key === "string" ? b.key : "";
  await setStockKey(service as StockService, key);
  if (!key.trim()) {
    sendJson(res, 200, { service, status: "not set", ...stockStatus() });
    return;
  }
  sendJson(res, 200, { service, status: await probeStock(service as StockService, key), ...stockStatus() });
}
