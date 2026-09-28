import { expect } from "vitest";
import { getCloudflareRuntimeTaskScheduler } from "@/lib/adapters/cloudflare-runtime";
import { domainStateTest } from "../shared/domain-state-fixture";
import { createFixturePrisma } from "../shared/prisma";

type CleanupProbe = {
  response?: Response;
  cancellations: number;
  users: string[];
};

const it = domainStateTest.extend<{
  suspendedIsAdmin: boolean;
  cleanupProbe: CleanupProbe;
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies.
  cleanupProbe: async ({}, use) => {
    const probe: CleanupProbe = { cancellations: 0, users: [] };
    await use(probe);
    // This fixture encloses state, so these checks run after its teardown.
    expect(probe.response).toBeDefined();
    expect(probe.cancellations).toBe(1);
    expect(probe.response?.bodyUsed).toBe(true);
    const db = createFixturePrisma();
    try {
      expect(probe.users).toHaveLength(4);
      expect(await db.user.count({ where: { id: { in: probe.users } } })).toBe(
        0,
      );
      expect(
        await db.session.count({ where: { userId: { in: probe.users } } }),
      ).toBe(0);
    } finally {
      await db.$disconnect();
    }
  },
  suspendedIsAdmin: async ({ cleanupProbe }, use) => {
    // Make the probe a dependency of state without introducing shared state.
    expect(cleanupProbe.cancellations).toBe(0);
    await use(true);
  },
});

it("reclaims the original response after background rejection and permits the next operation", async ({
  state,
  cleanupProbe,
}) => {
  cleanupProbe.users = [...state.users];
  const failure = new Error("domain background failed");
  await expect(
    state.runtime(async () => {
      getCloudflareRuntimeTaskScheduler()?.(Promise.reject(failure));
      cleanupProbe.response = new Response(
        new ReadableStream({
          cancel() {
            cleanupProbe.cancellations++;
          },
        }),
      );
      return cleanupProbe.response;
    }),
  ).rejects.toMatchObject({ errors: [failure] });
  expect(cleanupProbe.cancellations).toBe(0);
  expect(cleanupProbe.response?.body?.locked).toBe(false);
  await expect(state.runtime(async () => "healthy operation")).resolves.toBe(
    "healthy operation",
  );
});

it("reclaims only the wrapped response after a successful operation", async ({
  state,
  cleanupProbe,
}) => {
  cleanupProbe.users = [...state.users];
  const response = await state.runtime(async () => {
    cleanupProbe.response = new Response(
      new ReadableStream({
        cancel() {
          cleanupProbe.cancellations++;
        },
      }),
    );
    return cleanupProbe.response;
  });
  expect(response).not.toBe(cleanupProbe.response);
  expect(cleanupProbe.response?.body?.locked).toBe(true);
  expect(response.body?.locked).toBe(false);
  expect(cleanupProbe.cancellations).toBe(0);
});
