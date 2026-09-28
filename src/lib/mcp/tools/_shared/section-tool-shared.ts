import { jsonToolResult } from "./helper-results";
import { resolveMcpMode } from "./helper-schemas";

export function sectionNotFoundToolResult(
  sectionJwId: number,
  mode?: "default" | "full",
) {
  return jsonToolResult(
    {
      success: false,
      error: "not_found",
      found: false,
      message: `Section ${sectionJwId} was not found`,
      hint: "Use catalog_section_search to find a valid section jwId, or catalog_section_match_preview if you only have a section code.",
    },
    { mode: resolveMcpMode(mode) },
  );
}
