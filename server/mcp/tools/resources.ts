// Resources: fonts, stickers, photos, masks.
import { MASKS, listFonts, listPhotos, searchStickers, stickerCategories } from "../../resources.js";
import { toolError } from "../trust.js";

export function listResourcesTool(kind: unknown, query: unknown = ""): string {
  if (typeof kind !== "string") return toolError("kind must be fonts|stickers|categories|photos|masks");
  if (typeof query !== "string") return toolError("query must be text (empty lists everything)");
  if (kind === "fonts") return JSON.stringify(listFonts(query));
  if (kind === "stickers") {
    return JSON.stringify(
      searchStickers(query).map((e) => ({
        id: String(e.file ?? e.id ?? ""),
        label: String(e.label ?? e.name ?? ""),
      })),
    );
  }
  if (kind === "photos") return JSON.stringify(listPhotos(query));
  if (kind === "masks") return JSON.stringify(MASKS);
  if (kind === "categories") return JSON.stringify(stickerCategories());
  return toolError(`unknown kind ${JSON.stringify(kind)} (use fonts|stickers|categories|photos|masks)`);
}
