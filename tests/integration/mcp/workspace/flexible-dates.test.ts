import { parseOptionalMcpDate } from "@/lib/mcp/tools/_shared/helper-dates";
import { flexDateInputSchema } from "@/lib/mcp/tools/_shared/helper-schemas";
import { actorFixture, prisma } from "../_harness";
import { mcpTest } from "../_harness/context";

const toolTest = mcpTest.extend(
  "context",
  actorFixture({
    emailPrefix: "mcp-date-contract",
    name: "MCP date contract",
  }),
);

toolTest("mcp.flexible-date-inputs", async ({ context, expect }) => {
  for (const [input, expected] of [
    ["2026-05-01", "2026-05-01T00:00:00.000Z"],
    ["2026-05-01T08:00:00", "2026-05-01T00:00:00.000Z"],
    ["2026-05-01T08:00:00+08:00", "2026-05-01T00:00:00.000Z"],
    ["2026-05-01T08:00:00-04:00", "2026-05-01T12:00:00.000Z"],
  ]) {
    expect(flexDateInputSchema.safeParse(input).success).toBe(true);
    const created = await context.client.call<{ success: boolean; id: string }>(
      "workspace_todo_create",
      { title: input, dueAt: input },
    );
    expect(created.success).toBe(true);
    const stored = await prisma.todo.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.dueAt?.toISOString()).toBe(expected);
    const updated = await context.client.call<{ success: boolean }>(
      "workspace_todo_update",
      { id: created.id, dueAt: input },
    );
    expect(updated.success).toBe(true);
    expect(
      (
        await prisma.todo.findUniqueOrThrow({ where: { id: created.id } })
      ).dueAt?.toISOString(),
    ).toBe(expected);
  }
  const count = await prisma.todo.count({ where: { userId: context.userId } });
  for (const input of [
    "not-a-date",
    "2026-02-31",
    "2026-02-31T08:00:00+08:00",
  ]) {
    expect(flexDateInputSchema.safeParse(input).success).toBe(true);
    const result = await context.client.call<{
      success: boolean;
      message: string;
    }>("workspace_todo_create", {
      title: "Invalid date must not write",
      dueAt: input,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid dueAt");
    expect(result.message).toContain("YYYY-MM-DD");
  }
  expect(await prisma.todo.count({ where: { userId: context.userId } })).toBe(
    count,
  );
  for (const value of ["", " ", 0, null, {}])
    expect(flexDateInputSchema.safeParse(value).success).toBe(false);
  const shanghaiDay = parseOptionalMcpDate("atTime", "2026-05-01", {
    dateOnlyAsShanghaiStart: true,
  });
  expect(shanghaiDay.ok).toBe(true);
  if (!shanghaiDay.ok) throw new Error("Expected valid Shanghai date");
  expect(shanghaiDay.value?.toISOString()).toBe("2026-04-30T16:00:00.000Z");
});
