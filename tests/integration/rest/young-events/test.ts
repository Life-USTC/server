import { expect } from "@playwright/test";
import { test as baseTest } from "../../../e2e/utils/owned-worker";

const base = "/api/catalog/young-events";
const test = baseTest.extend<{
  events: { marker: string; activeId: string; endedId: string };
}>({
  events: async ({ isolatedWorker, run }, use) => {
    await use(
      await run(() =>
        isolatedWorker.database.owner.$transaction(async (db) => {
          const marker = `[integration-test] rest-young-${crypto.randomUUID()}`;
          const activeId = crypto.randomUUID();
          const endedId = crypto.randomUUID();
          await db.youngEvent.createMany({
            data: [
              {
                youngId: activeId,
                name: `${marker} active`,
                category: "讲座",
                isActive: true,
                rawJson: { fixture: "known event" },
                imageUrl: "group1/M00/test.jpg",
                activityLevel: "校级",
                module: "智",
                form: "线下",
                sponsor: "测试主办方",
                contactName: "活动老师",
                contactTel: "0551-12345678",
                signupStatusCode: "open",
                places: [{ placeInfo: "测试教室" }],
                description:
                  '<p>活动详情</p><img src="https://young.ustc.edu.cn/login/group1/M00/inline.jpg"><script>alert(1)</script>',
                participationNotes: "<p>请携带学生证</p>",
              },
              {
                youngId: endedId,
                name: `${marker} ended`,
                category: "实践",
                isActive: false,
                rawJson: {},
              },
            ],
          });
          return { marker, activeId, endedId };
        }),
      ),
    );
  },
});

test("known events expose pagination, summary fields and public cache headers", {
  tag: "@Young/REST",
}, async ({ request, events, run }) => {
  await run(async () => {
    const response = await request.get(
      `${base}?search=${encodeURIComponent(events.marker)}`,
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe(
      "public, max-age=0, stale-while-revalidate=300",
    );
    expect(response.headers()["cloudflare-cdn-cache-control"]).toBe(
      "public, max-age=86400, stale-while-revalidate=300",
    );
    const body = await response.json();
    expect(body.pagination).toMatchObject({ page: 1, total: 2, totalPages: 1 });
    expect(body.pagination.pageSize).toEqual(expect.any(Number));
    expect(body.data).toHaveLength(2);
    expect(body.data).toContainEqual(
      expect.objectContaining({
        youngId: events.activeId,
        name: `${events.marker} active`,
        category: "讲座",
        isActive: true,
      }),
    );
  });
});

test("active filter selects the known active event and excludes the ended event", {
  tag: "@Young/REST",
}, async ({ request, events, run }) => {
  await run(async () => {
    const response = await request.get(
      `${base}?active=true&search=${encodeURIComponent(events.marker)}`,
    );
    expect(response.status()).toBe(200);
    expect((await response.json()).data).toEqual([
      expect.objectContaining({ youngId: events.activeId, isActive: true }),
    ]);
  });
});

test("unmatched search returns an empty page", { tag: "@Young/REST" }, async ({
  request,
  run,
}) => {
  await run(async () => {
    const response = await request.get(
      `${base}?search=missing-${crypto.randomUUID()}`,
    );
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      data: [],
      pagination: { total: 0, totalPages: 1 },
    });
  });
});

test("invalid active parameter returns JSON 400", {
  tag: "@Young/REST",
}, async ({ request, run }) => {
  await run(async () => {
    const response = await request.get(`${base}?active=maybe`);
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
});

test("known detail exposes structured fields and sanitizes upstream rich text", {
  tag: "@Young/REST",
}, async ({ request, events, run }) => {
  await run(async () => {
    const response = await request.get(`${base}/${events.activeId}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      youngId: events.activeId,
      name: `${events.marker} active`,
      rawJson: { fixture: "known event" },
      imageUrl: "/api/catalog/young-events/images/group1/M00/test.jpg",
      activityLevel: "校级",
      module: "智",
      form: "线下",
      sponsor: "测试主办方",
      contactName: "活动老师",
      contactTel: "0551-12345678",
      signupStatusCode: "open",
      places: [{ placeInfo: "测试教室", placeSt: null, placeEt: null }],
    });
    expect(body.description).toContain(
      "/api/catalog/young-events/images/group1/M00/inline.jpg",
    );
    expect(body.description).not.toContain("young.ustc.edu.cn");
    expect(body.description).not.toContain("<script");
    expect(body.participationNotes).toContain("学生证");
    expect(body).not.toHaveProperty("registrationStatus");
  });
});

for (const module of ["智", "劳"]) {
  test(`module ${module} and activity level apply exact filters`, {
    tag: "@Young/REST",
  }, async ({ request, events, run }) => {
    await run(async () => {
      const query = new URLSearchParams({
        module,
        activityLevel: "校级",
        search: events.marker,
      });
      const response = await request.get(`${base}?${query}`);
      expect(response.status()).toBe(200);
      expect((await response.json()).data).toEqual(
        module === "智"
          ? [expect.objectContaining({ youngId: events.activeId })]
          : [],
      );
    });
  });
}

for (const suffix of ["", "/image"]) {
  test(`unknown event ${suffix || "detail"} returns JSON 404`, {
    tag: "@Young/REST",
  }, async ({ request, run }) => {
    await run(async () => {
      const response = await request.get(
        `${base}/missing-${crypto.randomUUID()}${suffix}`,
      );
      expect(response.status()).toBe(404);
      expect((await response.json()).error).toEqual(expect.any(String));
    });
  });
}

test("known ended event without a poster returns 404", {
  tag: "@Young/REST",
}, async ({ request, events, run }) => {
  await run(async () => {
    const response = await request.get(`${base}/${events.endedId}/image`);
    expect(response.status()).toBe(404);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
});

test("image proxy rejects path traversal", { tag: "@Young/REST" }, async ({
  request,
  run,
}) => {
  await run(async () => {
    const response = await request.get(
      `${base}/images/group1/..%2F..%2Fsecret.jpg`,
    );
    expect(response.status()).toBe(404);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
});
