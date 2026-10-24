import { expect, it, vi } from "vitest";
import { createDeferred } from "../../shared/deferred";

it("keeps awaited outbound and binding calls with their own concurrent probe", async () => {
  const forwardedFetch = vi.fn(async () => new Response("upstream"));
  vi.stubGlobal("fetch", forwardedFetch);
  vi.resetModules();
  const { handleCommunityEffectProbe, observeCommunityEffects } = await import(
    "../../ci/fixtures/community-effect-probe"
  );
  const binding = { get: vi.fn(async () => "native-value") };
  const env = {
    NODE_ENV: "test",
    E2E_STORAGE_SECRET: "unit-probe",
    CALENDAR_EXPORTS: binding,
    WEATHER: binding,
  };
  const secret = { "x-test-storage-secret": "unit-probe" };
  const ids = [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
  ];
  const observed = [];
  for (const id of ids) {
    const registration = await handleCommunityEffectProbe(
      new Request(
        `https://worker.test/__test/community-effects?id=${id}&io=1`,
        { method: "POST", headers: secret },
      ),
      env as never,
    );
    expect(registration?.status).toBe(201);
    observed.push(
      observeCommunityEffects(
        new Request("https://worker.test/path", {
          headers: { ...secret, "x-test-community-probe": id },
        }),
        env,
        { waitUntil: vi.fn() } as never,
      ),
    );
  }
  const ready = createDeferred();
  await Promise.all(
    observed.map((probe, index) =>
      probe.fetch(async () => {
        if (index === 0) await ready.promise;
        else ready.resolve();
        await probe.env.WEATHER.get();
        await globalThis.fetch(
          `https://upstream-${index}.test/token?private=excluded`,
          {
            method: index ? "POST" : "GET",
            headers: { authorization: "excluded" },
          },
        );
        return new Response(null, { status: 204 });
      }),
    ),
  );
  for (const [index, id] of ids.entries()) {
    const response = await handleCommunityEffectProbe(
      new Request(`https://worker.test/__test/community-effects?id=${id}`, {
        headers: secret,
      }),
      env as never,
    );
    const result = await response?.json();
    expect(result.io).toEqual({
      bindings: [{ binding: "WEATHER", method: "get" }],
      outbound: [
        {
          method: index ? "POST" : "GET",
          origin: `https://upstream-${index}.test`,
        },
      ],
    });
    expect(result.backgroundErrors).toEqual([]);
    await handleCommunityEffectProbe(
      new Request(`https://worker.test/__test/community-effects?id=${id}`, {
        method: "DELETE",
        headers: secret,
      }),
      env as never,
    );
  }
  expect(forwardedFetch).toHaveBeenCalledTimes(2);
  expect(binding.get).toHaveBeenCalledTimes(2);
});
