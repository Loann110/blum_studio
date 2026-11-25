// Check: lint a design (findings + score) and the score alone, with text
// overflow measured on the real fonts (server/lint.ts).
import { lintMeasured } from "../../lint.js";
import { loadDesign, toolError } from "../trust.js";

export async function checkDesignTool(id: unknown): Promise<string> {
  const { design, err } = loadDesign(id);
  if (err) return err;
  try {
    return JSON.stringify(await lintMeasured(design as Record<string, unknown>));
  } catch (e) {
    return toolError(`could not lint the design: ${(e as Error).message}`);
  }
}

export async function polishScoreTool(id: unknown): Promise<string> {
  const { design, err } = loadDesign(id);
  if (err) return err;
  try {
    const report = await lintMeasured(design as Record<string, unknown>);
    const errors = report.findings.filter((f) => f.level === "error").length;
    const warnings = report.findings.filter((f) => f.level === "warn").length;
    return JSON.stringify({ score: report.score, errors, warnings });
  } catch (e) {
    return toolError(`could not score the design: ${(e as Error).message}`);
  }
}
