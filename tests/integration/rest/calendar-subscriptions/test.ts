import { expect } from "@playwright/test";
import { calendarSubscriptionBatchResponseSchema } from "@/lib/api/schemas/misc-response-schema-core";
import { test } from "./_fixture";

const base = "/api/workspace/subscriptions";
const batch = `${base}/batch`;
const importCodes = `${base}/import-codes`;

for (const [method, path] of [
  ["patch", base],
  ["delete", base],
  ["post", importCodes],
  ["post", batch],
] as const) {
  test(`anonymous ${method} ${path} returns JSON 401`, {
    tag: "@Subscription/REST",
  }, async ({ run, request }) => {
    await run(async () => {
      const response = await request[method](path, {
        data: { sectionIds: [1], codes: ["known"], action: "add" },
      });
      expect(response.status()).toBe(401);
      expect(response.headers()["content-type"]).toContain("application/json");
      expect((await response.json()).error).toEqual(expect.any(String));
    });
  });
}

test("repeated anonymous body PATCH ignores forged internal headers", {
  tag: "@Subscription/REST",
}, async ({ run, request }) => {
  await run(async () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const response = await request.patch(base, {
        data: { sectionIds: [1] },
        headers:
          attempt % 2 === 0
            ? {
                "x-life-public-ssr": "1",
                "x-life-public-ssr-locale": "en-us",
                "x-life-public-ssr-mode": "page",
                "x-life-ustc-request-id": "client-controlled-internal-id",
                "x-request-id": "client-controlled-id",
              }
            : undefined,
      });
      expect(response.status()).toBe(401);
    }
  });
});

for (const [method, data] of [
  ["patch", { sectionIds: [0] }],
  ["delete", { sectionIds: [0] }],
  ["delete", {}],
  ["patch", { sectionIds: "not-an-array" }],
] as const) {
  test(`${method} rejects ${JSON.stringify(data)} without changing subscriptions`, {
    tag: "@Subscription/REST",
  }, async ({ run, calendarState }) => {
    await run(async () => {
      const { db, owner, other, section } = calendarState;
      await db.userSectionSubscription.createMany({
        data: [owner, other].map(({ id }) => ({
          userId: id,
          sectionId: section.id,
        })),
      });
      const before = await db.userSectionSubscription.findMany({
        where: { sectionId: section.id },
        orderBy: { userId: "asc" },
      });
      const response = await owner.request[method](base, { data });
      expect(response.status()).toBe(400);
      expect((await response.json()).error).toEqual(expect.any(String));
      expect(
        await db.userSectionSubscription.findMany({
          where: { sectionId: section.id },
          orderBy: { userId: "asc" },
        }),
      ).toEqual(before);
    });
  });
}

test("import codes adds matches, reports unmatched codes and is idempotent", {
  tag: "@Subscription/REST",
}, async ({ run, calendarState }) => {
  await run(async () => {
    const { db, owner, other, section } = calendarState;
    await db.userSectionSubscription.create({
      data: { userId: other.id, sectionId: section.id },
    });
    const otherBefore = await db.userSectionSubscription.findMany({
      where: { userId: other.id },
    });
    const response = await owner.request.post(importCodes, {
      data: {
        codes: [section.code, "MISSING.CODE"],
        semesterId: section.semesterId,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      matchedCodes: [section.code],
      unmatchedCodes: ["MISSING.CODE"],
      addedCount: 1,
      alreadySubscribedCount: 0,
      addedSections: [
        expect.objectContaining({ id: section.id, code: section.code }),
      ],
      subscription: {
        userId: owner.id,
        sections: [expect.objectContaining({ id: section.id })],
      },
    });
    expect(
      await db.userSectionSubscription.findMany({
        where: { userId: owner.id },
        select: { sectionId: true },
      }),
    ).toEqual([{ sectionId: section.id }]);
    const repeated = await owner.request.post(importCodes, {
      data: { codes: [section.code], semesterId: section.semesterId },
    });
    expect(repeated.status()).toBe(200);
    expect(await repeated.json()).toMatchObject({
      addedCount: 0,
      alreadySubscribedCount: 1,
      alreadySubscribedSections: [
        expect.objectContaining({ code: section.code }),
      ],
    });
    expect(
      await db.userSectionSubscription.count({ where: { userId: owner.id } }),
    ).toBe(1);
    expect(
      await db.userSectionSubscription.findMany({
        where: { userId: other.id },
      }),
    ).toEqual(otherBefore);
  });
});

test("append preserves known subscriptions, drops unknown IDs and reports repeated additions", {
  tag: "@Subscription/REST",
}, async ({ run, calendarState }) => {
  await run(async () => {
    const { db, owner, other, section, second } = calendarState;
    await db.userSectionSubscription.createMany({
      data: [
        { userId: owner.id, sectionId: section.id },
        { userId: other.id, sectionId: second.id },
      ],
    });
    const otherBefore = await db.userSectionSubscription.findMany({
      where: { userId: other.id },
    });
    const response = await owner.request.patch(base, {
      data: { sectionIds: [second.id, 999_999_999] },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      addedCount: 1,
      alreadySubscribedCount: 0,
      subscription: { userId: owner.id },
    });
    expect(
      body.subscription.sections
        .map((row: { id: number }) => row.id)
        .sort((a: number, b: number) => a - b),
    ).toEqual([section.id, second.id].sort((a, b) => a - b));
    expect(
      await db.userSectionSubscription.findMany({
        where: { userId: owner.id },
        select: { sectionId: true },
        orderBy: { sectionId: "asc" },
      }),
    ).toEqual(
      [section.id, second.id]
        .sort((a, b) => a - b)
        .map((sectionId) => ({ sectionId })),
    );
    const repeated = await owner.request.patch(base, {
      data: { sectionIds: [second.id] },
    });
    expect(repeated.status()).toBe(200);
    expect(await repeated.json()).toMatchObject({
      addedCount: 0,
      alreadySubscribedCount: 1,
    });
    expect(
      await db.userSectionSubscription.findMany({
        where: { userId: other.id },
      }),
    ).toEqual(otherBefore);
    const read = await owner.request.get(`${base}/current`);
    expect(read.status()).toBe(200);
    expect(
      (await read.json()).subscription.sections
        .map((row: { id: number }) => row.id)
        .sort((a: number, b: number) => a - b),
    ).toEqual([section.id, second.id].sort((a, b) => a - b));
  });
});

for (const alreadySubscribed of [false, true]) {
  for (const entry of ["append", "batch"] as const) {
    test(`${entry} excludes retired selection and ${alreadySubscribed ? "preserves" : "does not create"} a subscription`, {
      tag: "@Subscription/REST",
    }, async ({ run, calendarState }) => {
      await run(async () => {
        const { db, owner, section } = calendarState;
        await db.section.update({
          where: { id: section.id },
          data: { retiredAt: new Date("2026-01-01T00:00:00Z") },
        });
        if (alreadySubscribed)
          await db.userSectionSubscription.create({
            data: { userId: owner.id, sectionId: section.id },
          });
        const response =
          entry === "append"
            ? await owner.request.patch(base, {
                data: { sectionIds: [section.id] },
              })
            : await owner.request.post(batch, {
                data: {
                  action: "add",
                  sectionIds: [section.id],
                  semesterId: section.semesterId,
                },
              });
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.addedCount).toBe(0);
        if (entry === "append") expect(body.alreadySubscribedCount).toBe(0);
        else
          expect(body).toMatchObject({
            unchangedCount: 0,
            matchedSectionIds: [],
            unmatchedSectionIds: [section.id],
          });
        expect(
          body.subscription.sections.map((row: { id: number }) => row.id),
        ).toEqual(alreadySubscribed ? [section.id] : []);
        expect(
          await db.userSectionSubscription.findMany({
            where: { userId: owner.id },
            select: { sectionId: true },
          }),
        ).toEqual(alreadySubscribed ? [{ sectionId: section.id }] : []);
      });
    });
  }
}

for (const action of ["add", "remove"] as const) {
  test(`batch ${action} changes only selected semester subscriptions`, {
    tag: "@Subscription/REST",
  }, async ({ run, calendarState }) => {
    await run(async () => {
      const { db, owner, other, section, previous } = calendarState;
      expect(previous.semesterId).not.toBe(section.semesterId);
      await db.userSectionSubscription.createMany({
        data: [
          { userId: owner.id, sectionId: section.id },
          { userId: other.id, sectionId: previous.id },
          ...(action === "remove"
            ? [{ userId: owner.id, sectionId: previous.id }]
            : []),
        ],
      });
      const otherBefore = await db.userSectionSubscription.findMany({
        where: { userId: other.id },
      });
      const response = await owner.request.post(batch, {
        data: {
          action,
          sectionIds: [previous.id],
          semesterId: previous.semesterId,
        },
      });
      expect(response.status()).toBe(200);
      expect(
        calendarSubscriptionBatchResponseSchema.parse(await response.json()),
      ).toMatchObject({
        addedCount: action === "add" ? 1 : 0,
        removedCount: action === "remove" ? 1 : 0,
      });
      const expected = (
        action === "add" ? [section.id, previous.id] : [section.id]
      ).sort((a, b) => a - b);
      expect(
        await db.userSectionSubscription.findMany({
          where: { userId: owner.id },
          select: { sectionId: true },
          orderBy: { sectionId: "asc" },
        }),
      ).toEqual(expected.map((sectionId) => ({ sectionId })));
      const repeated = await owner.request.post(batch, {
        data: {
          action,
          sectionIds: [previous.id],
          semesterId: previous.semesterId,
        },
      });
      expect(repeated.status()).toBe(200);
      expect(
        calendarSubscriptionBatchResponseSchema.parse(await repeated.json()),
      ).toMatchObject({
        addedCount: 0,
        removedCount: 0,
        unchangedCount: 1,
      });
      expect(
        await db.userSectionSubscription.findMany({
          where: { userId: other.id },
        }),
      ).toEqual(otherBefore);
    });
  });
}

for (const retired of [false, true]) {
  test(`remove ${retired ? "retired" : "active"} subscription preserves a concurrent addition`, {
    tag: "@Subscription/REST",
  }, async ({ run, calendarState }) => {
    await run(async () => {
      const { db, owner, other, section, second } = calendarState;
      if (retired)
        await db.section.update({
          where: { id: section.id },
          data: { retiredAt: new Date() },
        });
      await db.userSectionSubscription.createMany({
        data: [owner, other].map(({ id }) => ({
          userId: id,
          sectionId: section.id,
        })),
      });
      const otherBefore = await db.userSectionSubscription.findMany({
        where: { userId: other.id },
      });
      const [removed, added] = await Promise.all([
        owner.request.delete(base, { data: { sectionIds: [section.id] } }),
        owner.request.patch(base, { data: { sectionIds: [second.id] } }),
      ]);
      expect(removed.status()).toBe(200);
      expect(added.status()).toBe(200);
      expect(
        await db.userSectionSubscription.findMany({
          where: { userId: owner.id },
          select: { sectionId: true },
        }),
      ).toEqual([{ sectionId: second.id }]);
      expect(
        await db.userSectionSubscription.findMany({
          where: { userId: other.id },
        }),
      ).toEqual(otherBefore);
      const read = await owner.request.get(`${base}/current`);
      expect(read.status()).toBe(200);
      expect(
        (await read.json()).subscription.sections.map(
          (row: { id: number }) => row.id,
        ),
      ).toEqual([second.id]);
    });
  });
}
