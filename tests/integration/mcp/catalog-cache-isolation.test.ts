import { isolatedMcpTest } from "./_harness/isolated-context";

// Both cases deliberately reuse the same database IDs and public origin. Their
// real production cache entries must still belong to their own catalog state.
for (const code of ["CACHE.A", "CACHE.B"]) {
  isolatedMcpTest(
    `private MCP catalog reads retain ${code} across repeated requests`,
    async ({ mcpActor, mcpSection, isolatedDatabase, expect }) => {
      await isolatedDatabase.owner.section.update({
        where: { id: mcpSection.id },
        data: { code },
      });
      for (let read = 0; read < 2; read++) {
        const result = await mcpActor.client.call<{
          found: boolean;
          section: { jwId: number; code: string };
        }>("catalog_section_get", { jwId: mcpSection.jwId, mode: "full" });
        expect(result).toMatchObject({
          found: true,
          section: { jwId: mcpSection.jwId, code },
        });
      }
    },
  );
}
