import { afterAll, expect, it, vi } from "vitest";
import {
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "../../shared/catalog-contract-fixture";
import { createFixturePrisma } from "../../shared/prisma";
import { createEphemeralMcpUser } from "./_harness/context";

const db = createFixturePrisma();
afterAll(() => db.$disconnect());

it("MCP actor initialization failure removes the actor and its committed personal data", async () => {
  let userId = "";
  const failure = new Error("fixture setup failure");
  await expect(
    createEphemeralMcpUser({
      emailPrefix: "failed-mcp-setup",
      name: "Failed MCP setup",
      setup: async (id) => {
        userId = id;
        await db.todo.create({
          data: { userId: id, title: "Partially initialized" },
        });
        throw failure;
      },
    }),
  ).rejects.toBe(failure);
  expect(userId).not.toBe("");
  expect(await db.user.findUnique({ where: { id: userId } })).toBeNull();
  expect(await db.todo.count({ where: { userId } })).toBe(0);
});

it("MCP teardown failures still close the transport and delete actor state", async () => {
  const fixture = await createEphemeralMcpUser({
    emailPrefix: "failed-mcp-cleanup",
    name: "Failed MCP cleanup",
    cleanup: async () => {
      throw new Error("custom cleanup failure");
    },
  });
  const originalClose = fixture.client.close;
  fixture.client.close = async () => {
    await originalClose();
    throw new Error("transport cleanup failure");
  };
  await db.todo.create({
    data: { userId: fixture.userId, title: "Must be removed" },
  });
  await expect(fixture.close()).rejects.toMatchObject({
    errors: [
      new Error("transport cleanup failure"),
      new Error("custom cleanup failure"),
    ],
  });
  expect(
    await db.user.findUnique({ where: { id: fixture.userId } }),
  ).toBeNull();
  expect(await db.todo.count({ where: { userId: fixture.userId } })).toBe(0);
});

it("catalog initialization rolls back earlier records when a later entity conflicts", async () => {
  const base = 1_680_000_000;
  const existing = await db.teacher.create({
    data: { jwId: base, nameCn: "Unrelated teacher" },
  });
  const random = vi.spyOn(Math, "random").mockReturnValue(0.8);
  try {
    await expect(createCatalogContractFixture(db)).rejects.toThrow();
    random.mockRestore();
    expect(await db.semester.count({ where: { jwId: base } })).toBe(0);
    expect(
      await db.department.count({ where: { jwId: { in: [base, base + 1] } } }),
    ).toBe(0);
    expect(
      await db.teacherTitle.count({
        where: { jwId: { in: [base, base + 1] } },
      }),
    ).toBe(0);
    expect(
      await db.teacher.findUnique({ where: { id: existing.id } }),
    ).toMatchObject({ nameCn: "Unrelated teacher" });
  } finally {
    random.mockRestore();
    await db.teacher.deleteMany({ where: { id: existing.id } });
  }
});

it("catalog cleanup preserves unrelated records inside the former random numeric range", async () => {
  const fixture = await createCatalogContractFixture(db);
  let unrelatedId: number | undefined;
  try {
    const unrelated = await db.course.create({
      data: {
        jwId: fixture.base + 90,
        code: `unrelated-${fixture.marker}`,
        nameCn: "Unrelated course",
      },
    });
    unrelatedId = unrelated.id;
    await cleanupCatalogContractFixture(db, fixture);
    expect(
      await db.course.findUnique({ where: { id: unrelated.id } }),
    ).toMatchObject({ nameCn: "Unrelated course" });
    expect(
      await db.section.count({
        where: { id: { in: fixture.cleanupIds.sections } },
      }),
    ).toBe(0);
  } finally {
    if (unrelatedId) await db.course.deleteMany({ where: { id: unrelatedId } });
    await cleanupCatalogContractFixture(db, fixture);
  }
});
