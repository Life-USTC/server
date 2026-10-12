import { expect } from "@playwright/test";
import { resolveSeedSectionId } from "../../../../e2e/utils/seed-lookups";
import { assertApiContract } from "../../_shared/api-contract";
import { test } from "../../_shared/catalog-reader-fixture";

test("/api/catalog/sections/calendar.ics 契约", {
  tag: "@Calendar/ICS",
}, async ({ run, request }) => {
  return run(async () => {
    await assertApiContract(request, {
      routePath: "/api/catalog/sections/calendar.ics",
    });
  });
});

test("/api/catalog/sections/calendar.ics 返回日历文本", {
  tag: "@Calendar/ICS",
}, async ({ run, request }) => {
  return run(async () => {
    const sectionId = await resolveSeedSectionId(request);

    const response = await request.get(
      `/api/catalog/sections/calendar.ics?sectionIds=${sectionId}`,
    );
    expect(response.status()).toBe(200);
    const content = await response.text();
    expect(content).toContain("BEGIN:VCALENDAR");
    expect(content).toContain("END:VCALENDAR");
  });
});

test("/api/catalog/sections/calendar.ics accepts exactly 50 unique IDs", {
  tag: "@Calendar/ICS",
}, async ({ run, request }) => {
  return run(async () => {
    const sectionId = await resolveSeedSectionId(request);
    const unusedIds = Array.from(
      { length: 49 },
      (_, index) => 2_000_000_000 + index,
    );
    const ids = [sectionId, ...unusedIds].sort((left, right) => left - right);

    const response = await request.get(
      `/api/catalog/sections/calendar.ics?sectionIds=${ids.join(",")}`,
    );

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("BEGIN:VCALENDAR");
  });
});

test("/api/catalog/sections/calendar.ics rejects 51 unique IDs", {
  tag: "@Calendar/ICS",
}, async ({ run, request }) => {
  return run(async () => {
    const ids = Array.from({ length: 51 }, (_, index) => index + 1);
    const response = await request.get(
      `/api/catalog/sections/calendar.ics?sectionIds=${ids.join(",")}`,
    );

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "sectionIds must contain at most 50 unique IDs",
    });
  });
});

test("/api/catalog/sections/calendar.ics canonicalizes duplicate IDs", {
  tag: "@Calendar/ICS",
}, async ({ run, request, baseURL }) => {
  return run(async () => {
    const response = await request.get(
      "/api/catalog/sections/calendar.ics?sectionIds=3,1,3",
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(
      new URL("/api/catalog/sections/calendar.ics?sectionIds=1%2C3", baseURL)
        .href,
    );
  });
});

test("/api/catalog/sections/calendar.ics rejects malformed IDs", {
  tag: "@Calendar/ICS",
}, async ({ run, request }) => {
  return run(async () => {
    const response = await request.get(
      "/api/catalog/sections/calendar.ics?sectionIds=1,invalid,2",
    );

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid sectionIds parameter",
    });
  });
});
