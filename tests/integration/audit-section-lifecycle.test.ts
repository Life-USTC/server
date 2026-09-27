import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import { reconcileSectionPresence } from "@/static-loader/section-lifecycle";
import { createFixturePrisma, createTestPrisma } from "../shared/prisma";

const fixture = createFixturePrisma();
// static-sync.yml runs the importer with MIGRATOR_DATABASE_URL, not the app role.
const importer = createTestPrisma(process.env.FUNCTION_OWNER_DATABASE_URL);
const observedAt = new Date("2026-09-20T12:00:00Z");
const previousRetiredAt = new Date("2026-09-19T12:00:00Z");
let semesterId: number;
let courseId: number;
let missing: { id: number; jwId: number };
let present: { id: number; jwId: number };
let outside: { id: number; jwId: number };
let outsideSemesterId: number;
beforeEach(async () => {
  const marker = crypto.randomUUID();
  const jwId = 1800000000 + Math.floor(Math.random() * 100000000);
  semesterId = (
    await fixture.semester.create({
      data: { jwId, code: marker, nameCn: marker },
    })
  ).id;
  outsideSemesterId = (
    await fixture.semester.create({
      data: { jwId: jwId + 1, code: `outside-${marker}`, nameCn: marker },
    })
  ).id;
  courseId = (
    await fixture.course.create({
      data: { jwId, code: marker, nameCn: marker },
    })
  ).id;
  missing = await fixture.section.create({
    data: { jwId, code: marker, courseId, semesterId },
    select: { id: true, jwId: true },
  });
  present = await fixture.section.create({
    data: {
      jwId: jwId + 1,
      code: marker,
      courseId,
      semesterId,
      retiredAt: previousRetiredAt,
    },
    select: { id: true, jwId: true },
  });
  outside = await fixture.section.create({
    data: {
      jwId: jwId + 2,
      code: marker,
      courseId,
      semesterId: outsideSemesterId,
    },
    select: { id: true, jwId: true },
  });
});
afterEach(async () => {
  await fixture.auditLog.deleteMany({
    where: {
      targetType: "section",
      targetId: {
        in: [String(missing.id), String(present.id), String(outside.id)],
      },
    },
  });
  await fixture.section.deleteMany({ where: { courseId } });
  await fixture.course.delete({ where: { id: courseId } });
  await fixture.semester.deleteMany({
    where: { id: { in: [semesterId, outsideSemesterId] } },
  });
});
afterAll(async () => {
  await importer.$disconnect();
  await fixture.$disconnect();
});
function reconcile(snapshotSha256 = "private-snapshot-sha256") {
  return importer.$transaction((tx) =>
    reconcileSectionPresence(tx, {
      observedAt,
      scopedSemesterIds: [semesterId],
      seenSectionJwIds: [present.jwId],
      snapshotSha256,
    }),
  );
}
it("audit.writer-3", async () => {
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
it("audit.action-section-retire", async () => {
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
it("audit.action-section-reactivate", async () => {
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
