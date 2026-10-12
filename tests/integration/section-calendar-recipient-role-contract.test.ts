import { expect } from "vitest";
import { rlsTest as it } from "../shared/rls-fixture";

it("maintenance discovers only the requested section recipients while owner RLS remains intact", {
  tags: ["@Calendar/Permissions"],
}, async ({
  isolatedDatabase: { owner, app, auth, maintenance },
  rlsActors: { firstUserId, secondUserId, adminUserId },
  rlsSections: { sectionId, writeProbeSectionId },
}) => {
  await owner.userSectionSubscription.createMany({
    data: [
      { userId: firstUserId, sectionId, kind: "regular" },
      { userId: secondUserId, sectionId, kind: "teaching_assistant" },
      { userId: adminUserId, sectionId: writeProbeSectionId, kind: "auditor" },
    ],
  });
  expect(
    await maintenance.$queryRaw`
    SELECT "userId" FROM public.list_section_calendar_subscribers(${sectionId}, NULL, 100)
  `,
  ).toEqual([secondUserId, firstUserId].sort().map((userId) => ({ userId })));
  expect(
    await maintenance.$queryRaw`
    SELECT "userId" FROM public.list_section_calendar_subscribers(${writeProbeSectionId}, NULL, 100)
  `,
  ).toEqual([{ userId: adminUserId }]);
  expect(
    await maintenance.$queryRaw`
    SELECT "userId" FROM public.list_section_calendar_subscribers(-1, NULL, 100)
  `,
  ).toEqual([]);
  await expect(maintenance.$queryRaw`
    SELECT "userId", "sectionId" FROM public."UserSectionSubscription"
  `).rejects.toMatchObject({
    code: "P2010",
    meta: { driverAdapterError: { cause: { code: "42501" } } },
  });
  for (const client of [app, auth]) {
    await expect(client.$queryRaw`
      SELECT "userId" FROM public.list_section_calendar_subscribers(${sectionId}, NULL, 100)
    `).rejects.toMatchObject({
      code: "P2010",
      meta: { driverAdapterError: { cause: { code: "42501" } } },
    });
  }
  expect(await app.userSectionSubscription.findMany()).toEqual([]);
  await app.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${firstUserId}, true)`;
    expect(
      await tx.userSectionSubscription.findMany({
        select: { userId: true, sectionId: true, kind: true },
      }),
    ).toEqual([{ userId: firstUserId, sectionId, kind: "regular" }]);
    expect(
      await tx.userSectionSubscription.updateMany({
        where: { userId: secondUserId },
        data: { kind: "auditor" },
      }),
    ).toEqual({ count: 0 });
  });
  expect(
    await owner.userSectionSubscription.findUniqueOrThrow({
      where: { userId_sectionId: { userId: secondUserId, sectionId } },
      select: { kind: true },
    }),
  ).toEqual({ kind: "teaching_assistant" });
  expect(
    await owner.$queryRaw`
    SELECT relrowsecurity, relforcerowsecurity
    FROM pg_catalog.pg_class WHERE oid = 'public."UserSectionSubscription"'::regclass
  `,
  ).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);
});

it("section recipient discovery bounds each ordered page without losing subscription kinds", {
  tags: ["@Calendar/Permissions"],
}, async ({
  isolatedDatabase: { owner, maintenance },
  rlsSections: { sectionId },
}) => {
  const users = Array.from({ length: 103 }, (_, index) => ({
    id: `recipient-${String(index).padStart(3, "0")}`,
    email: `recipient-${index}@test.invalid`,
  }));
  await owner.$transaction(async (tx) => {
    await tx.user.createMany({ data: users });
    await tx.userSectionSubscription.createMany({
      data: users.map((user, index) => ({
        userId: user.id,
        sectionId,
        kind: (["regular", "auditor", "teaching_assistant"] as const)[
          index % 3
        ],
      })),
    });
  });
  const rows = (start: number, end: number) =>
    users.slice(start, end).map((user) => ({ userId: user.id }));
  expect(
    await maintenance.$queryRaw`
    SELECT "userId" FROM public.list_section_calendar_subscribers(${sectionId}, NULL, 1000)
  `,
  ).toEqual(rows(0, 100));
  expect(
    await maintenance.$queryRaw`
    SELECT "userId" FROM public.list_section_calendar_subscribers(${sectionId}, ${users[99].id}, 100)
  `,
  ).toEqual(rows(100, 103));
  expect(
    await maintenance.$queryRaw`
    SELECT "userId" FROM public.list_section_calendar_subscribers(${sectionId}, ${users[102].id}, 100)
  `,
  ).toEqual([]);
  for (const size of [0, -1, null])
    expect(
      await maintenance.$queryRaw`
      SELECT "userId" FROM public.list_section_calendar_subscribers(${sectionId}, NULL, ${size}::integer)
    `,
    ).toEqual(rows(0, 1));
});
