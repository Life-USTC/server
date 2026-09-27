import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseConfigFileTextToJson } from "typescript";
import { expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import {
  type CloudflareRateLimiter,
  runWithCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";
import {
  patchCalendarSubscriptionsRoute,
  postCalendarSubscriptionQueryRoute,
} from "@/lib/api/routes/calendar-subscriptions";
import { createFixturePrisma } from "../shared/prisma";

it("subscription.per-user-rate-limit", { timeout: 60_000 }, async () => {
  const db = createFixturePrisma();
  const directory = await mkdtemp(join(tmpdir(), "subscription-rate-"));
  const config = parseConfigFileTextToJson(
    "wrangler.jsonc",
    await readFile(new URL("../../wrangler.jsonc", import.meta.url), "utf8"),
  ).config;
  const batch = config.ratelimits.find(
    (binding: { name: string }) =>
      binding.name === "USER_BATCH_WRITE_RATE_LIMITER",
  );
  expect(batch).toBeDefined();
  const configPath = join(directory, "wrangler.json");
  await writeFile(
    configPath,
    JSON.stringify({
      name: "subscription-rate-contract",
      compatibility_date: config.compatibility_date,
      ratelimits: [batch],
    }),
  );
  const platform = await getPlatformProxy<{
    USER_BATCH_WRITE_RATE_LIMITER: CloudflareRateLimiter;
  }>({ configPath, persist: false, envFiles: [] });
  const marker = crypto.randomUUID();
  const users: string[] = [];
  let courseId: number | undefined;
  try {
    const { getBetterAuthInstance } = await import("@/lib/auth/core");
    const auth = await getBetterAuthInstance().$context;
    const cookies: string[] = [];
    for (let i = 0; i < 2; i++) {
      const user = await db.user.create({
        data: {
          email: `rate-${marker}-${i}@example.test`,
          name: `Rate owner ${i}`,
        },
      });
      users.push(user.id);
      const token = crypto.randomUUID();
      await db.session.create({
        data: {
          userId: user.id,
          sessionToken: token,
          expires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(auth.secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(token),
      );
      const value = encodeURIComponent(
        `${token}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`,
      );
      cookies.push(`${auth.authCookies.sessionToken.name}=${value}`);
    }
    const base = 1_600_000_000 + Math.floor(Math.random() * 10_000_000);
    const course = await db.course.create({
      data: { jwId: base, code: `RATE-${marker}`, nameCn: "限流课程" },
    });
    courseId = course.id;
    const section = await db.section.create({
      data: { jwId: base + 1, code: `RATE-${marker}.01`, courseId },
    });
    const second = await db.section.create({
      data: { jwId: base + 2, code: `RATE-${marker}.02`, courseId },
    });
    const databaseUrl = process.env.DATABASE_URL;
    const authDatabaseUrl = process.env.AUTH_DATABASE_URL;
    if (!databaseUrl || !authDatabaseUrl)
      throw new Error("Runtime and auth database URLs are required");
    const env = {
      NODE_ENV: "test",
      APP_PUBLIC_ORIGIN: "http://localhost:3000",
      DATABASE_URL: databaseUrl,
      HYPERDRIVE: { connectionString: databaseUrl },
      HYPERDRIVE_AUTH: { connectionString: authDatabaseUrl },
      USER_BATCH_WRITE_RATE_LIMITER: platform.env.USER_BATCH_WRITE_RATE_LIMITER,
    };
    const request = (owner: number, sectionId: number, query = false) =>
      new Request(
        `http://localhost:3000/api/workspace/subscriptions${query ? "/query" : ""}`,
        {
          method: query ? "POST" : "PATCH",
          headers: {
            cookie: cookies[owner],
            "content-type": "application/json",
          },
          body: JSON.stringify({ sectionIds: [sectionId] }),
        },
      );
    await runWithCloudflareRuntimeEnv(env, async () => {
      for (let i = 0; i < batch.simple.limit; i++) {
        expect(
          (await patchCalendarSubscriptionsRoute(request(0, section.id)))
            .status,
        ).toBe(200);
      }
      const rejected = await patchCalendarSubscriptionsRoute(
        request(0, second.id),
      );
      expect(rejected.status).toBe(429);
      expect(rejected.headers.get("retry-after")).toBe(
        String(batch.simple.period),
      );
      expect(
        (
          await db.userSectionSubscription.findMany({
            where: { userId: users[0] },
          })
        ).map(({ sectionId }) => sectionId),
      ).toEqual([section.id]);
      expect(
        (await postCalendarSubscriptionQueryRoute(request(0, second.id, true)))
          .status,
      ).toBe(200);
      expect(
        (await patchCalendarSubscriptionsRoute(request(1, second.id))).status,
      ).toBe(200);
      expect(
        (
          await db.userSectionSubscription.findMany({
            where: { userId: users[1] },
          })
        ).map(({ sectionId }) => sectionId),
      ).toEqual([second.id]);
    });
  } finally {
    await db.auditLog.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    if (courseId) {
      await db.section.deleteMany({ where: { courseId } });
      await db.course.delete({ where: { id: courseId } });
    }
    await db.$disconnect();
    await platform.dispose();
    await rm(directory, { recursive: true, force: true });
  }
});
