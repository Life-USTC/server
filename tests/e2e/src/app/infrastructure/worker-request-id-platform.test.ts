import { test as base, expect } from "@playwright/test";
import { createTestHarness, type TestHarness } from "wrangler";

const test = base.extend<{ platform: TestHarness }>({
  // Each case owns a real workerd runtime; Wrangler owns its listener and teardown.
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  platform: async ({}, use, testInfo) => {
    const platform = createTestHarness({
      workers: [{ configPath: "wrangler.observability.jsonc" }],
    });
    try {
      await platform.listen();
      await use(platform);
      expect(
        platform
          .getLogs()
          .filter((entry) =>
            /edge\.request\.observation\.error|Uncaught Error/.test(
              entry.message,
            ),
          ),
      ).toEqual([]);
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) platform.debug();
      await platform.close();
    }
  },
});

const ownership = { tag: "@Infrastructure/Runtime" };

test(
  "request ID preserves an immutable workerd redirect",
  ownership,
  async ({ platform }) => {
    const response = await platform.fetch("/redirect");
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({
      immutableError: "TypeError:Can't modify immutable headers.",
      same: false,
      status: 302,
      statusText: "Found",
      location: "https://example.test/target",
      requestId: "66666666-6666-4666-8666-666666666666",
    });
  },
);

test(
  "request ID preserves workerd response metadata and stream identity",
  ownership,
  async ({ platform }) => {
    const response = await platform.fetch("/metadata");
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({
      body: "streamed",
      bodySame: true,
      status: 206,
      statusText: "Partial Content",
      requestId: "11111111-1111-4111-8111-111111111111",
      cookies: ["session=one", "theme=dark"],
      cf: { cacheStatus: "HIT" },
      contentEncoding: "gzip",
    });
  },
);

test(
  "request ID preserves a workerd WebSocket response",
  ownership,
  async ({ platform }) => {
    const response = await platform.fetch("/websocket");
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({
      status: 101,
      hasWebSocket: true,
      requestId: "77777777-7777-4777-8777-777777777777",
    });
  },
);

for (const state of ["locked", "disturbed"] as const) {
  test(
    `request ID rejects a ${state} workerd body`,
    ownership,
    async ({ platform }) => {
      const response = await platform.fetch(`/${state}`);
      expect(response.ok).toBe(true);
      expect(await response.json()).toEqual({
        error: "TypeError:Response body is locked or disturbed.",
      });
    },
  );
}

test(
  "request ID propagates unrelated header failures",
  ownership,
  async ({ platform }) => {
    const response = await platform.fetch("/non-immutable");
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({
      error: "TypeError:header sink unavailable",
    });
  },
);

test(
  "request ID preserves manual gzip encoding over HTTP",
  ownership,
  async ({ platform }) => {
    const { url } = await platform.listen();
    // Fetch through the bound HTTP listener so decoding verifies wire encoding.
    const response = await fetch(new URL("/encoding", url), {
      headers: { "Accept-Encoding": "gzip" },
    });
    expect(response.ok).toBe(true);
    expect(response.headers.get("x-request-id")).toBe(
      "44444444-4444-4444-8444-444444444444",
    );
    expect(await response.text()).toBe("encoded");
  },
);
