// Resources over HTTP: fonts, stickers, categories, photos, masks.
import type { IncomingMessage, ServerResponse } from "node:http";
import { fail, sendJson } from "../http.js";
import {
  MASKS,
  listFonts,
  listPhotos,
  searchStickers,
  stickerCategories,
  stickerFile,
} from "../resources.js";

export async function resourcesRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/api/resources", "http://x");
  const kind = url.searchParams.get("kind") ?? "stickers";
  const query = url.searchParams.get("query") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? "200") || 200;
  if (kind === "fonts") sendJson(res, 200, listFonts(query));
  else if (kind === "stickers") {
    sendJson(
      res,
      200,
      searchStickers(query, limit).map((e) => ({
        id: stickerFile(e),
        label: String(e.label ?? ""),
        category: String(e.category ?? ""),
        pack: String(e.pack ?? ""),
        // Keywords ride along so the editor can filter the cached catalogue
        // locally with the same matching as the server.
        keywords: Array.isArray(e.keywords) ? (e.keywords as unknown[]).filter((k) => typeof k === "string") : [],
      })),
    );
  } else if (kind === "categories") sendJson(res, 200, stickerCategories());
  else if (kind === "photos") sendJson(res, 200, listPhotos(query, limit));
  else if (kind === "masks") sendJson(res, 200, MASKS);
  else fail(res, 400, "kind must be fonts|stickers|categories|photos|masks");
}
