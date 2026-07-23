import { jsonToolResult, resolveMcpMode } from "@/lib/mcp/tools/_helpers";

export function sectionNotFoundToolResult(
  sectionJwId: number,
  mode?: "summary" | "default" | "full",
) {
  return jsonToolResult(
    {
      success: false,
      found: false,
      message: `Section ${sectionJwId} was not found`,
      hint: "Use catalog_section_search to find a valid section jwId, or catalog_section_match_preview if you only have a section code.",
    },
    { mode: resolveMcpMode(mode) },
  );
}
