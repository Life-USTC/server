import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseConfigFileTextToJson } from "typescript";
import { expect } from "vitest";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import type { CloudflareRateLimiter } from "@/lib/adapters/cloudflare-runtime";
import {
  patchCalendarSubscriptionsRoute,
  postCalendarSubscriptionQueryRoute,
} from "@/lib/api/routes/calendar-subscriptions";
import { nodeProtocolTest } from "../shared/node-protocol-fixture";

type LimiterPlatform = PlatformProxy<{
  USER_BATCH_WRITE_RATE_LIMITER: CloudflareRateLimiter;
}>;

function ownLimiterPlatform() {
  let directory: string | undefined;
  let platform: LimiterPlatform | undefined;
  let starting: ReturnType<typeof start> | undefined;
  let closing: Promise<void> | undefined;

  async function start() {
    const config = parseConfigFileTextToJson(
      "wrangler.jsonc",
      await readFile(new URL("../../wrangler.jsonc", import.meta.url), "utf8"),
    ).config;
    const batch = config.ratelimits.find(
      (binding: { name: string }) =>
        binding.name === "USER_BATCH_WRITE_RATE_LIMITER",
    );
    expect(batch).toBeDefined();
    directory = await mkdtemp(join(tmpdir(), "subscription-rate-"));
    const configPath = join(directory, "wrangler.json");
    await writeFile(
      configPath,
      JSON.stringify({
        name: "subscription-rate-contract",
        compatibility_date: config.compatibility_date,
        ratelimits: [batch],
      }),
    );
    // The SDK exposes dispose only after this promise resolves. Internal
    // startup rejection before that handle exists needs native fault evidence.
    platform = await getPlatformProxy<{
      USER_BATCH_WRITE_RATE_LIMITER: CloudflareRateLimiter;
    }>({ configPath, persist: false, remoteBindings: false, envFiles: [] });
    return { platform, batch };
  }

  return {
    initialize() {
      if (closing) throw new Error("Subscription limiter platform is closing");
      starting ??= start();
      return starting;
    },
    close() {
      closing ??= (async () => {
        // A fixture timeout does not cancel getPlatformProxy. Wait for late
        // acquisition before disposing it or removing its temporary config.
        await starting?.catch(() => undefined);
        const results = await Promise.allSettled([platform?.dispose()]);
        if (directory) {
          results.push(
            ...(await Promise.allSettled([
              rm(directory, { recursive: true, force: true }),
            ])),
          );
        }
        const failures = results.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : [],
        );
        if (failures.length)
          throw new AggregateError(
            failures,
            "Subscription limiter cleanup failed",
          );
      })();
      return closing;
    },
  };
}

const it = nodeProtocolTest.extend<{
  limiterPlatform: ReturnType<typeof ownLimiterPlatform>;
}>({
  limiterPlatform: async ({ isolatedDatabase, onTestFinished }, use) => {
    // Depend on the private database owner so it outlives proxy/request cleanup.
    void isolatedDatabase;
    const owned = ownLimiterPlatform();
    try {
      // Register teardown before a dependent starts any asynchronous allocation.
      await use(owned);
    } finally {
      try {
        await owned.close();
      } catch (error) {
        onTestFinished(() => {
          throw error;
        });
      }
    }
  },
}).extend({
  protocolBindings: async ({ limiterPlatform }, use) => {
    const { platform } = await limiterPlatform.initialize();
    await use({
      NODE_ENV: "test",
      USER_BATCH_WRITE_RATE_LIMITER: platform.env.USER_BATCH_WRITE_RATE_LIMITER,
    });
  },
});

it("subscription.per-user-rate-limit", { timeout: 60_000 }, async ({
  isolatedDatabase,
  protocolRuntime,
  limiterPlatform,
}) => {
  await protocolRuntime.run(async () => {
    const db = isolatedDatabase.owner;
    const { batch } = await limiterPlatform.initialize();
    const marker = crypto.randomUUID();
    const { users, tokens, section, second } = await db.$transaction(
      async (tx) => {
        const users: string[] = [];
        const tokens: string[] = [];
        for (let i = 0; i < 2; i++) {
          const user = await tx.user.create({
            data: {
              email: `rate-${marker}-${i}@example.test`,
              name: `Rate owner ${i}`,
            },
          });
          users.push(user.id);
          const token = crypto.randomUUID();
          tokens.push(token);
          await tx.session.create({
            data: {
              userId: user.id,
              sessionToken: token,
              expires: new Date(Date.now() + 60 * 60 * 1000),
            },
          });
        }
        const base = 1_600_000_000 + Math.floor(Math.random() * 10_000_000);
        const course = await tx.course.create({
          data: { jwId: base, code: `RATE-${marker}`, nameCn: "限流课程" },
        });
        const section = await tx.section.create({
          data: { jwId: base + 1, code: `RATE-${marker}.01`, courseId: course.id },
        });
        const second = await tx.section.create({
          data: { jwId: base + 2, code: `RATE-${marker}.02`, courseId: course.id },
        });
        return { users, tokens, section, second };
      },
    );
    const cookies = await protocolRuntime.request(async () => {
      const { getBetterAuthInstance } = await import("@/lib/auth/core");
      const auth = await getBetterAuthInstance().$context;
      const cookies: string[] = [];
      for (const token of tokens) {
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
      return cookies;
    });
    async function invoke(
      handler: typeof patchCalendarSubscriptionsRoute,
      input: Request,
    ) {
      const response = await protocolRuntime.request(() => handler(input));
      // Finish the original response while the complete workflow still owns it.
      await response.text();
      return response;
    }
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
    for (let i = 0; i < batch.simple.limit; i++) {
      expect(
        (await invoke(patchCalendarSubscriptionsRoute, request(0, section.id)))
          .status,
      ).toBe(200);
    }
    const rejected = await invoke(
      patchCalendarSubscriptionsRoute,
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
      (
        await invoke(
          postCalendarSubscriptionQueryRoute,
          request(0, second.id, true),
        )
      ).status,
    ).toBe(200);
    expect(
      (await invoke(patchCalendarSubscriptionsRoute, request(1, second.id)))
        .status,
    ).toBe(200);
    expect(
      (
        await db.userSectionSubscription.findMany({
          where: { userId: users[1] },
        })
      ).map(({ sectionId }) => sectionId),
    ).toEqual([second.id]);
  });
});
