import { expect } from "@playwright/test";
import { createFixturePrisma } from "../../../../shared/prisma";
import { test } from "../../_harness/actor";

const base = "/api/catalog/links/resolve";

test("anonymous visit redirects to the target without following it", async ({
  request,
}) => {
  const response = await request.get(`${base}?slug=jw`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("https://jw.ustc.edu.cn/");
});

test("authenticated visits increment only the current owner's click count", async ({
  createActor,
}) => {
  const owner = await createActor();
  const other = await createActor();
  const db = createFixturePrisma();
  try {
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
  } finally {
    await db.$disconnect();
  }
});

for (const query of ["?slug=nonexistent-e2e", ""]) {
  test(`invalid visit ${query || "missing slug"} redirects without recording a click`, async ({
    createActor,
  }) => {
    const owner = await createActor();
    const db = createFixturePrisma();
    try {
      const response = await owner.request.get(`${base}${query}`, {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(307);
      expect(response.headers().location).toMatch(/\/$/);
      expect(
        await db.catalogLinkClick.count({ where: { userId: owner.id } }),
      ).toBe(0);
    } finally {
      await db.$disconnect();
    }
  });
}
