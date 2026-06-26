import { resolveAppHealthUrl } from "@tools/dev/health";
import { describe, expect, it } from "vitest";

describe("app health runtime", () => {
  it("defaults to the host-native dev server", () => {
    expect(resolveAppHealthUrl({}).toString()).toBe("http://127.0.0.1:3000/");
  });

  it("uses APP_DEV_PORT without reading Playwright runtime settings", () => {
    expect(
      resolveAppHealthUrl({
        APP_DEV_PORT: "3001",
        PLAYWRIGHT_PORT: "3101",
        PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3102",
      }).toString(),
    ).toBe("http://127.0.0.1:3001/");
  });

  it("prefers APP_HEALTH_URL for explicit probes", () => {
    expect(
      resolveAppHealthUrl({
        APP_DEV_PORT: "3001",
        APP_HEALTH_URL: "http://127.0.0.1:3002/api/health",
      }).toString(),
    ).toBe("http://127.0.0.1:3002/api/health");
  });
});
