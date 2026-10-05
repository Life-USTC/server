import {
  type APIRequestContext,
  expect,
  type TestInfo,
} from "@playwright/test";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test } from "../../../e2e/utils/owned-worker";
import { createCatalogContractFixture } from "../../../shared/catalog-contract-fixture";

test.use({ storageState: { cookies: [], origins: [] } });

async function publicList(
  request: APIRequestContext,
  kind: "courses" | "sections" | "teachers",
  isolatedWorker: IsolatedWorker,
  testInfo: TestInfo,
) {
  const db = isolatedWorker.database.owner;
  const { fixture, user } = await db.$transaction(async (tx) => {
    const fixture = await createCatalogContractFixture({
      $transaction: async (work) => work(tx),
    });
    const user = await tx.user.create({
      data: {
        email: `${fixture.marker}@example.test`,
        name: "Catalog contract viewer",
        username: fixture.marker,
      },
    });
    return { fixture, user };
  });
  const secret = { "x-test-storage-secret": "local-test-storage-observer" };
  const probeId = crypto.randomUUID();
  const probePath = `/__test/community-effects?id=${probeId}`;
  const headers = { ...secret, "x-test-community-probe": probeId };
  const errors: unknown[] = [];
  let registered = false;
  let completed = false;
  try {
    const registration = await request.post(probePath, { headers: secret });
    registered = registration.status() === 201;
    await registration.body();
    expect(registration.status()).toBe(201);
    const search = fixture.marker;
    const base = `/api/catalog/${kind}?${new URLSearchParams({ search, pageSize: "1" })}`;
    const first = await request.get(base, { headers });
    await first.body();
    expect(first.status()).toBe(200);
    const zh = await first.json();
    expect(zh.pagination.total).toBe(2);
    expect(zh.data).toHaveLength(1);
    const cookie = (await isolatedWorker.createSession(user.id)).cookie;
    const withCookie = await request.get(base, {
      headers: {
        ...headers,
        cookie: `${cookie.name}=${cookie.value}; NEXT_LOCALE=en-us`,
        "accept-language": "en-US,en;q=0.9",
      },
    });
    await withCookie.body();
    expect(await withCookie.json()).toEqual(zh);
    expect(withCookie.headers()["cache-control"]).toContain("public");
    expect(withCookie.headers().vary ?? "").not.toMatch(
      /cookie|accept-language/i,
    );
    const english = await request.get(`${base}&locale=en-us`, {
      headers: {
        ...headers,
        cookie: "NEXT_LOCALE=zh-cn",
        "accept-language": "zh-CN",
      },
    });
    await english.body();
    const en = await english.json();
    const localized = (row: {
      namePrimary?: string;
      course?: { namePrimary: string };
    }) => (kind === "sections" ? row.course?.namePrimary : row.namePrimary);
    expect(localized(en.data[0])).toMatch(
      kind === "teachers" ? /Same Name Teacher/ : /Contract Course/,
    );
    expect(localized(zh.data[0])).toMatch(
      kind === "teachers" ? /同名教师/ : /契约课程/,
    );
    const second = await request.get(`${base}&page=2`, { headers });
    await second.body();
    const page2 = await second.json();
    expect(page2.pagination.total).toBe(2);
    expect(page2.data).toHaveLength(1);
    expect(page2.data[0].id).not.toBe(zh.data[0].id);
    const filter =
      kind === "courses"
        ? `jwIds=${fixture.courses[0].jwId}`
        : kind === "sections"
          ? `courseJwId=${fixture.courses[0].jwId}`
          : `departmentId=${fixture.departments[0].id}`;
    const filteredUrl = new URL(base, "http://localhost");
    if (kind === "courses")
      filteredUrl.searchParams.set("search", fixture.courses[0].code);
    else
      for (const [key, value] of new URLSearchParams(filter))
        filteredUrl.searchParams.set(key, value);
    const filtered = await request.get(
      filteredUrl.pathname + filteredUrl.search,
      { headers },
    );
    await filtered.body();
    expect((await filtered.json()).pagination.total).toBe(1);
    completed = true;
  } catch (error) {
    errors.push(error);
  }
  // The caller's owned run retains this entire HTTP/body chain and its final
  // producer drain. No browser or page fixture is acquired for these contracts.
  if (registered) {
    try {
      const response = await request.get(probePath, { headers: secret });
      await response.body();
      expect(response.status()).toBe(200);
      const effects = await response.json();
      await testInfo.attach("public-list-effects", {
        contentType: "application/json",
        body: JSON.stringify(effects),
      });
      expect(effects.backgroundErrors).toEqual([]);
      expect(effects.messages).toEqual([]);
      expect(effects.purges).toEqual([]);
      if (completed) {
        expect(effects.requests).toHaveLength(5);
        for (const request of effects.requests) {
          expect(request).toMatchObject({
            outcome: "fulfilled",
            value: { method: "GET", path: `/api/catalog/${kind}` },
            result: 200,
          });
        }
      } else {
        for (const request of effects.requests) {
          expect(request.outcome).toBe("fulfilled");
          expect(request.result).toEqual(expect.any(Number));
        }
      }
    } catch (error) {
      errors.push(error);
    }
  }
  // DELETE performs a final drain even when the preceding observation failed.
  // Complete that fallback before observing state; retain either failure.
  if (registered) {
    try {
      const response = await request.delete(probePath, { headers: secret });
      await response.body();
      expect(response.status()).toBe(204);
    } catch (error) {
      errors.push(error);
    }
  }
  const observations = await Promise.allSettled([
    (async () => {
      const account = await db.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(account.calendarFeedToken).toBeNull();
    })(),
    (async () => {
      expect(await db.auditLog.findMany()).toEqual([]);
    })(),
  ]);
  errors.push(
    ...observations.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    ),
  );
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(errors, "Public list HTTP workflow failed");
}

test(
  "course.public-list-cache",
  { tag: "@Course/REST" },
  async ({ request, isolatedWorker, run }, testInfo) => {
    await run(() => publicList(request, "courses", isolatedWorker, testInfo));
  },
);
test(
  "section.public-list-cache",
  { tag: "@Section/REST" },
  async ({ request, isolatedWorker, run }, testInfo) => {
    await run(() => publicList(request, "sections", isolatedWorker, testInfo));
  },
);
test(
  "teacher.public-list-cache",
  { tag: "@Teacher/REST" },
  async ({ request, isolatedWorker, run }, testInfo) => {
    await run(() => publicList(request, "teachers", isolatedWorker, testInfo));
  },
);
