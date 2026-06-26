import { describe, expect, it } from "vitest";
import { getRegisteredMcpToolNames } from "../../tools/shared/mcp-tool-registrations";

describe("MCP tool registration parser", () => {
  it("collects static registerTool names from AST call expressions", () => {
    const source = `
      server.registerTool("search_courses", {}, searchCoursesTool);
      registerTool(\`get_course_by_jw_id\`, {}, getCourseTool);
      server.registerTool(toolName, {}, dynamicTool);
      // server.registerTool("commented_out", {}, noop);
      const text = 'server.registerTool("string_only", {}, noop)';
    `;

    expect(getRegisteredMcpToolNames(source)).toEqual([
      "search_courses",
      "get_course_by_jw_id",
    ]);
  });
});
