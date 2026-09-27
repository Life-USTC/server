import { expect, it } from "vitest";
import { isPublicMcpTool } from "@/lib/mcp/tool-scopes";
import { readFeatureSpecifications } from "../../../../scripts/specifications/repository";

it("mcp.declared-tool-authentication", async () => {
  const features = await readFeatureSpecifications<{
    id: string;
    capabilities: Record<
      string,
      {
        auth: string;
        mcp?: string | { tools?: { name: string; auth?: string }[] };
      }
    >;
  }>();
  let compared = 0;
  for (const feature of features)
    for (const [id, capability] of Object.entries(feature.capabilities)) {
      if (typeof capability.mcp !== "object") continue;
      for (const tool of capability.mcp.tools ?? []) {
        const declared = tool.auth ?? capability.auth;
        expect(
          declared === "anon",
          `${feature.id}.${id}.${tool.name}: ${declared}`,
        ).toBe(isPublicMcpTool(tool.name));
        compared++;
      }
    }
  expect(compared).toBeGreaterThan(60);
});
