import { reconcileSectionPresence } from "@/static-loader/section-lifecycle";
import type { TestPrismaClient } from "../shared/prisma";
import { staticImporterTest as it } from "../shared/static-importer-fixture";

const observedAt = new Date("2026-09-20T12:00:00Z");
const previousRetiredAt = new Date("2026-09-19T12:00:00Z");

async function createLifecycle(
  fixture: TestPrismaClient,
  importer: TestPrismaClient,
) {
  const rows = await fixture.$transaction(async (tx) => {
    const marker = crypto.randomUUID();
    const jwId = 1800000000 + Math.floor(Math.random() * 100000000);
    const semesterId = (
      await tx.semester.create({
        data: { jwId, code: marker, nameCn: marker },
      })
    ).id;
    const outsideSemesterId = (
      await tx.semester.create({
        data: { jwId: jwId + 1, code: `outside-${marker}`, nameCn: marker },
      })
    ).id;
    const courseId = (
      await tx.course.create({
        data: { jwId, code: marker, nameCn: marker },
      })
    ).id;
    const missing = await tx.section.create({
      data: { jwId, code: marker, courseId, semesterId },
      select: { id: true, jwId: true },
    });
    const present = await tx.section.create({
      data: {
        jwId: jwId + 1,
        code: marker,
        courseId,
        semesterId,
        retiredAt: previousRetiredAt,
      },
      select: { id: true, jwId: true },
    });
    const outside = await tx.section.create({
      data: {
        jwId: jwId + 2,
        code: marker,
        courseId,
        semesterId: outsideSemesterId,
      },
      select: { id: true, jwId: true },
    });
    return { semesterId, courseId, missing, present, outside };
  });
  return {
    ...rows,
    reconcile(snapshotSha256 = "private-snapshot-sha256") {
      return importer.$transaction((tx) =>
        reconcileSectionPresence(tx, {
          observedAt,
          scopedSemesterIds: [rows.semesterId],
          seenSectionJwIds: [rows.present.jwId],
          snapshotSha256,
        }),
      );
    },
  };
}
it("audit.writer-3", async ({
  isolatedDatabase: { owner: fixture },
  importer,
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { courseId, missing, present, reconcile } = await createLifecycle(
      fixture,
      importer,
    );
    const before = await fixture.section.findMany({
      where: { courseId },
      orderBy: { id: "asc" },
    });
    await expect(reconcile("invalid\u0000snapshot")).rejects.toThrow();
    expect(
      await fixture.section.findMany({
        where: { courseId },
        orderBy: { id: "asc" },
      }),
    ).toEqual(before);
    expect(
      await fixture.auditLog.count({
        where: {
          targetType: "section",
          targetId: { in: [String(missing.id), String(present.id)] },
        },
      }),
    ).toBe(0);
    await reconcile();
    expect(
      (await fixture.section.findUniqueOrThrow({ where: { id: missing.id } }))
        .retiredAt,
    ).toEqual(observedAt);
    expect(
      (await fixture.section.findUniqueOrThrow({ where: { id: present.id } }))
        .retiredAt,
    ).toBeNull();
    expect(
      await fixture.auditLog.count({
        where: {
          targetType: "section",
          targetId: { in: [String(missing.id), String(present.id)] },
        },
      }),
    ).toBe(2);
  });
});
it("audit.action-section-retire", async ({
  isolatedDatabase: { owner: fixture },
  importer,
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { missing, outside, reconcile } = await createLifecycle(
      fixture,
      importer,
    );
    await reconcile();
    expect(
      (await fixture.section.findUniqueOrThrow({ where: { id: missing.id } }))
        .retiredAt,
    ).toEqual(observedAt);
    expect(
      (await fixture.section.findUniqueOrThrow({ where: { id: outside.id } }))
        .retiredAt,
    ).toBeNull();
    const rows = await fixture.auditLog.findMany({
      where: { targetType: "section", targetId: String(missing.id) },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "section_retire",
      metadata: {
        source: "static-loader",
        snapshotSha256: "private-snapshot-sha256",
        observedAt: observedAt.toISOString(),
        jwId: missing.jwId,
      },
    });
    expect(Object.keys(rows[0].metadata as object).sort()).toEqual([
      "jwId",
      "observedAt",
      "snapshotSha256",
      "source",
    ]);
    await reconcile();
    expect(
      await fixture.auditLog.findMany({
        where: { targetType: "section", targetId: String(missing.id) },
      }),
    ).toEqual(rows);
  });
});
it("audit.action-section-reactivate", async ({
  isolatedDatabase: { owner: fixture },
  importer,
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const { present, reconcile } = await createLifecycle(fixture, importer);
    await reconcile();
    expect(
      (await fixture.section.findUniqueOrThrow({ where: { id: present.id } }))
        .retiredAt,
    ).toBeNull();
    const rows = await fixture.auditLog.findMany({
      where: { targetType: "section", targetId: String(present.id) },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "section_reactivate",
      metadata: {
        source: "static-loader",
        snapshotSha256: "private-snapshot-sha256",
        observedAt: observedAt.toISOString(),
        jwId: present.jwId,
        previousRetiredAt: previousRetiredAt.toISOString(),
      },
    });
    expect(Object.keys(rows[0].metadata as object).sort()).toEqual([
      "jwId",
      "observedAt",
      "previousRetiredAt",
      "snapshotSha256",
      "source",
    ]);
    await reconcile();
    expect(
      await fixture.auditLog.findMany({
        where: { targetType: "section", targetId: String(present.id) },
      }),
    ).toEqual(rows);
  });
});
