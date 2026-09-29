import { expect } from "@playwright/test";
import { test } from "../../../../e2e/utils/owned-worker";

const base = "/api/catalog/links/resolve";

test("anonymous visit redirects to the target without following it", async ({
  request,
  run,
}) =>
  run(async () => {
    const response = await request.get(`${base}?slug=jw`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("https://jw.ustc.edu.cn/");
  }));

test("authenticated visits increment only the current owner's click count", async ({
  isolatedWorker,
  run,
}) =>
  run(async () => {
    const { createActor } = isolatedWorker;
    const db = isolatedWorker.database.owner;
    const owner = await createActor();
    const other = await createActor();
    await db.catalogLinkClick.createMany({
      data: [
        { userId: owner.id, slug: "jw", count: 3 },
        { userId: other.id, slug: "jw", count: 8 },
      ],
    });
    const otherBefore = await db.catalogLinkClick.findMany({
      where: { userId: other.id },
    });
    for (const count of [4, 5]) {
      const response = await owner.request.get(`${base}?slug=jw`, {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(307);
      expect(response.headers().location).toBe("https://jw.ustc.edu.cn/");
      expect(
        await db.catalogLinkClick.findUniqueOrThrow({
          where: { userId_slug: { userId: owner.id, slug: "jw" } },
        }),
      ).toMatchObject({ count });
    }
    expect(
      await db.catalogLinkClick.findMany({ where: { userId: other.id } }),
    ).toEqual(otherBefore);
  }));

for (const query of ["?slug=nonexistent-e2e", ""]) {
  test(`invalid visit ${query || "missing slug"} redirects without recording a click`, async ({
    isolatedWorker,
    run,
  }) =>
    run(async () => {
      const { createActor } = isolatedWorker;
      const db = isolatedWorker.database.owner;
      const owner = await createActor();
      const response = await owner.request.get(`${base}${query}`, {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(307);
      expect(response.headers().location).toMatch(/\/$/);
      expect(
        await db.catalogLinkClick.count({ where: { userId: owner.id } }),
      ).toBe(0);
    }));
}
