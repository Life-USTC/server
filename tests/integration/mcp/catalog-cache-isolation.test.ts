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

for (const title of ["Timetable A", "Timetable B"]) {
  isolatedMcpTest(
    `private MCP bus reads retain ${title} with matching import timestamps`,
    async ({ mcpActor, mcpBus, isolatedDatabase, expect }) => {
      await isolatedDatabase.owner.busScheduleVersion.update({
        where: { key: mcpBus.versionKey },
        data: { title, importedAt: new Date("2026-04-29T00:00:00.000Z") },
      });
      for (let read = 0; read < 2; read++) {
        const result = await mcpActor.client.call<{
          version: { key: string; title: string };
        }>("catalog_bus_timetable_get", { mode: "full" });
        expect(result.version).toMatchObject({ key: mcpBus.versionKey, title });
      }
    },
  );
}
