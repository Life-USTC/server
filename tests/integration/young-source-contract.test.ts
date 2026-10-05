import {
  toYoungEventSummary,
  YOUNG_EVENT_SELECT,
} from "@/features/young/server/young-event-service";
import {
  syncYoungEvents,
  syncYoungSnapshot,
} from "@/static-loader/import-young";
import type { Snapshot } from "@/static-loader/snapshot";
import { loadYoungEvents } from "@/static-loader/young-plan";
import type { TestPrismaClient } from "../shared/prisma";
import { staticImporterTest as it } from "../shared/static-importer-fixture";

it("young-event.organizer-identity", { tags: ["@Young/Service"] }, async ({
  isolatedDatabase: { owner: db },
  importer,
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const marker = crypto.randomUUID();
    const builds = [
      {
        youngId: `${marker}-1`,
        name: "One",
        organizer: ` Ｃｌｕｂ　 ${marker}\n`,
      },
      { youngId: `${marker}-2`, name: "Two", organizer: `club ${marker}` },
      { youngId: `${marker}-3`, name: "Three", organizer: `clubs ${marker}` },
      { youngId: `${marker}-4`, name: "Blank", organizer: " \n " },
    ].map((row) => ({ ...row, isActive: true, rawJson: "{}" }));
    await importer.$transaction((tx) => syncYoungEvents(tx, builds));
    const rows = await db.youngEvent.findMany({
      where: { youngId: { in: builds.map((row) => row.youngId) } },
      orderBy: { youngId: "asc" },
      select: { organizerId: true },
    });
    expect(rows[0].organizerId).toBeTruthy();
    expect(rows[1].organizerId).toBe(rows[0].organizerId);
    expect(rows[2].organizerId).not.toBe(rows[0].organizerId);
    expect(rows[3].organizerId).toBeNull();
    expect(
      await db.youngOrganizer.findUnique({
        where: { id: rows[0].organizerId as string },
        select: { normalizedName: true },
      }),
    ).toEqual({ normalizedName: `club ${marker}` });
    await importer.$transaction((tx) =>
      syncYoungEvents(tx, [
        { ...builds[0], organizer: `CLUB ${marker.toUpperCase()}` },
      ]),
    );
    expect(
      (
        await db.youngEvent.findUniqueOrThrow({
          where: { youngId: builds[0].youngId },
        })
      ).organizerId,
    ).toBe(rows[0].organizerId);
  });
});

it("young-event.snapshot-authoritative", { tags: ["@Young/Service"] }, async ({
  isolatedDatabase: { owner: db },
  importer,
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const marker = crypto.randomUUID();
    const seen = new Date("2026-09-20T01:00:00Z");
    const later = new Date("2026-09-21T01:00:00Z");
    const builds = ["present", "missing"].map((name) => ({
      youngId: `${marker}-${name}`,
      name,
      status: "Published",
      activityStatusCode: "26",
      isActive: true,
      rawJson: "{}",
    }));
    await importer.$transaction((tx) =>
      syncYoungEvents(tx, builds, { observedAt: seen }),
    );
    const before = await db.youngEvent.findMany({
      where: { youngId: { in: builds.map((row) => row.youngId) } },
      orderBy: { youngId: "asc" },
    });
    // An incomplete source has no successful Young timestamp and must not touch existing rows.
    expect(
      await importer.$transaction((tx) =>
        syncYoungSnapshot(
          tx,
          [{ ...builds[0], name: "partial update" }],
          undefined,
        ),
      ),
    ).toBeUndefined();
    expect(
      await db.youngEvent.findMany({
        where: { youngId: { in: builds.map((row) => row.youngId) } },
        orderBy: { youngId: "asc" },
      }),
    ).toEqual(before);
    await importer.$transaction((tx) =>
      syncYoungEvents(tx, [builds[0]], {
        observedAt: later,
        complete: true,
      }),
    );
    expect(
      await db.youngEvent.findUnique({ where: { youngId: builds[1].youngId } }),
    ).toMatchObject({
      sourceMissing: true,
      lastSeenAt: seen,
      status: "Published",
      activityStatusCode: "26",
      isActive: true,
    });
    expect(
      await db.youngEvent.findUnique({ where: { youngId: builds[0].youngId } }),
    ).toMatchObject({ sourceMissing: false, lastSeenAt: later });
    await importer.$transaction((tx) =>
      syncYoungEvents(tx, [], { observedAt: later, complete: true }),
    );
    expect(
      await db.youngEvent.count({
        where: {
          youngId: { in: builds.map((row) => row.youngId) },
          sourceMissing: true,
        },
      }),
    ).toBe(2);
    await importer.$transaction((tx) =>
      syncYoungEvents(tx, [builds[1]], {
        observedAt: later,
        complete: true,
      }),
    );
    expect(
      await db.youngEvent.findUnique({ where: { youngId: builds[1].youngId } }),
    ).toMatchObject({
      sourceMissing: false,
      lastSeenAt: later,
      status: "Published",
    });
  });
});

async function importSource(
  importer: TestPrismaClient,
  db: TestPrismaClient,
  input: Record<string, unknown>,
) {
  const youngId = crypto.randomUUID();
  const table = "young_mobile_item_enrolment_list_result_records";
  const snapshot = {
    metadata: () => ({ young_events_mode: "full" }),
    hasTable: (name: string) => name === table,
    queryAll: (name: string) =>
      name === table ? [{ id: youngId, ...input }] : [],
    queryGrouped: () => new Map(),
  } as unknown as Snapshot;
  const builds = loadYoungEvents(snapshot);
  if (!builds) throw new Error("Expected source builds");
  await importer.$transaction((tx) => syncYoungEvents(tx, builds));
  return toYoungEventSummary(
    await db.youngEvent.findUniqueOrThrow({
      where: { youngId },
      select: YOUNG_EVENT_SELECT,
    }),
  );
}

it("young-event.structured-participation", {
  tags: ["@Young/Service"],
}, async ({
  isolatedDatabase: { owner: db },
  importer,
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const event = await importSource(importer, db, {
      itemCategory: "0",
      itemCategory_dictText: "Category label",
      module: "I",
      module_dictText: "智",
      form: 0,
      form_dictText: "Form label",
      activityLevel: "school",
      activityLevel_dictText: "Level label",
      businessDeptId: "dept-1",
      organizer: "a,b,a",
      organizer_dictText: "Display organizer",
      sponsor: "s1, s2",
      itemLable: "tag-2,tag-1,tag-2,",
      applyRange: 2,
      rangeDeptIds: "d1,d2,d1",
    });
    expect(event).toMatchObject({
      categoryCode: "0",
      category: "Category label",
      moduleCode: "I",
      module: "智",
      formCode: "0",
      form: "Form label",
      activityLevelCode: "school",
      activityLevel: "Level label",
      departmentId: "dept-1",
      organizer: "Display organizer",
      upstreamOrganizerIds: ["a", "b"],
      upstreamSponsorIds: ["s1", "s2"],
      tagIds: ["tag-2", "tag-1"],
      signupScopeCode: "2",
      signupDepartmentIds: ["d1", "d2"],
    });
    expect(event.organizerId).toBeTruthy();
    expect(event.upstreamOrganizerIds).not.toContain(event.organizerId);
  });
});

it("young-event.participation-flag-normalization", {
  tags: ["@Young/Service"],
}, async ({
  isolatedDatabase: { owner: db },
  importer,
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    for (const [value, expected] of [
      [1, true],
      ["1", true],
      [0, false],
      ["0", false],
      [2, null],
      ["true", null],
      [null, null],
    ] as const) {
      const event = await importSource(importer, db, {
        needSignInfo: value,
        onlineStatus: value,
      });
      expect(event.requiresSignupInfo).toBe(expected);
      expect(event.isOnline).toBe(expected);
      expect(event.tagIds).toEqual([]);
      expect(event.allowedAttachmentTypes).toEqual([]);
      expect(event.upstreamOrganizerIds).toEqual([]);
      expect(event.upstreamSponsorIds).toEqual([]);
      expect(event.signupDepartmentIds).toEqual([]);
    }
  });
});

it("young-event.participation-sponsor-normalization", {
  tags: ["@Young/Service"],
}, async ({
  isolatedDatabase: { owner: db },
  importer,
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    for (const ewSponsor of [null, "", "暂无", " 无 "]) {
      const event = await importSource(importer, db, {
        ewSponsor,
        attaType: "PDF,.docx,pdf, bad/type,,ZIP",
      });
      expect(event.externalSponsor).toBeNull();
      expect(event.allowedAttachmentTypes).toEqual(["pdf", "docx", "zip"]);
    }
    expect(
      (await importSource(importer, db, { ewSponsor: " External sponsor " }))
        .externalSponsor,
    ).toBe("External sponsor");
  });
});
