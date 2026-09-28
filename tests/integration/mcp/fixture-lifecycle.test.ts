import { afterAll, vi } from "vitest";
import {
  cleanupCatalogContractFixture,
  createCatalogContractFixture,
} from "../../shared/catalog-contract-fixture";
import { createFixturePrisma } from "../../shared/prisma";
import { createEphemeralMcpUser, mcpTest } from "./_harness/context";

const db = createFixturePrisma();
afterAll(() => db.$disconnect());

mcpTest(
  "MCP actor initialization failure removes the actor and its committed personal data",
  async ({ expect }) => {
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
  },
);

mcpTest(
  "MCP teardown failures still close the transport and delete actor state",
  async ({ expect }) => {
    const eventId = crypto.randomUUID();
    const fixture = await createEphemeralMcpUser({
      emailPrefix: "failed-mcp-cleanup",
      name: "Failed MCP cleanup",
      setup: async (userId) => {
        await db.todo.create({
          data: { userId, title: "Must be removed" },
        });
        await db.featureOperationEvent.create({
          data: {
            id: eventId,
            userId,
            feature: "workspace.subscription",
            operation: "create",
            protocol: "mcp",
            surface: "mcp",
            authMode: "oauth",
            outcome: "success",
            errorClass: "none",
            durationMs: 1,
          },
        });
      },
      cleanup: async () => {
        throw new Error("custom cleanup failure");
      },
    });
    const originalClose = fixture.client.close;
    fixture.client.close = async () => {
      await originalClose();
      throw new Error("transport cleanup failure");
    };
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
    try {
      expect(
        await db.featureOperationEvent.findUnique({ where: { id: eventId } }),
      ).toBeNull();
    } finally {
      await db.featureOperationEvent.deleteMany({ where: { id: eventId } });
    }
  },
);

mcpTest(
  "catalog initialization rolls back earlier records when a later entity conflicts",
  async ({ expect }) => {
    const marker = crypto.randomUUID();
    const existing = await db.teacher.create({
      data: {
        jwId: 1_600_000_000 + Math.floor(Math.random() * 100_000_000),
        nameCn: `Unrelated teacher ${marker}`,
      },
    });
    let attemptedBase: number | undefined;
    const conflictingClient: Parameters<
      typeof createCatalogContractFixture
    >[0] = {
      $transaction: (run) =>
        db.$transaction(async (tx) => {
          const createTeacher = tx.teacher.create.bind(tx.teacher);
          const create = vi
            .spyOn(tx.teacher, "create")
            .mockImplementation((args) => {
              attemptedBase ??= args.data.jwId;
              return createTeacher({
                ...args,
                data: { ...args.data, jwId: existing.jwId },
              });
            });
          try {
            return await run(tx);
          } finally {
            create.mockRestore();
          }
        }),
    };
    try {
      await expect(
        createCatalogContractFixture(conflictingClient),
      ).rejects.toThrow();
      expect(attemptedBase).toBeTypeOf("number");
      if (attemptedBase === undefined)
        throw new Error("Teacher creation was not attempted");
      expect(await db.semester.count({ where: { jwId: attemptedBase } })).toBe(
        0,
      );
      expect(
        await db.department.count({
          where: { jwId: { in: [attemptedBase, attemptedBase + 1] } },
        }),
      ).toBe(0);
      expect(
        await db.teacherTitle.count({
          where: { jwId: { in: [attemptedBase, attemptedBase + 1] } },
        }),
      ).toBe(0);
      expect(
        await db.teacher.findUnique({ where: { id: existing.id } }),
      ).toMatchObject({ nameCn: `Unrelated teacher ${marker}` });
    } finally {
      await db.teacher.deleteMany({ where: { id: existing.id } });
    }
  },
);

mcpTest(
  "catalog cleanup preserves unrelated records inside the former random numeric range",
  async ({ expect }) => {
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
      if (unrelatedId)
        await db.course.deleteMany({ where: { id: unrelatedId } });
      await cleanupCatalogContractFixture(db, fixture);
    }
  },
);
