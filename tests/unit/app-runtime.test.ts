import {
  resolveAppHost,
  resolveAppPort,
  resolveHealthcheckUrl,
} from "@tools/dev/util/app-runtime";
import { describe, expect, it } from "vitest";

describe("app runtime", () => {
  it("uses configured app host before hostname", () => {
    expect(
      resolveAppHost({
        APP_HOST: " app.local ",
        HOSTNAME: "host.local",
      }),
    ).toBe("app.local");
    expect(resolveAppHost({ APP_HOST: " ", HOSTNAME: " host.local " })).toBe(
      "host.local",
    );
  });

  it("uses exact valid port values", () => {
    expect(resolveAppPort({ PORT: " 3100 " })).toBe("3100");
  });

  it("falls back for malformed or out-of-range ports", () => {
    expect(resolveAppPort({ PORT: "3100x" })).toBe("3000");
    expect(resolveAppPort({ PORT: "0" })).toBe("3000");
    expect(resolveAppPort({ PORT: "70000" })).toBe("3000");
  });

  it("uses configured healthcheck URL or falls back to the resolved port", () => {
    expect(
      resolveHealthcheckUrl({
        HEALTHCHECK_URL: " http://127.0.0.1:3100/health ",
      }),
    ).toBe("http://127.0.0.1:3100/health");
    expect(resolveHealthcheckUrl({ PORT: "3101" })).toBe(
      "http://127.0.0.1:3101/",
    );
  });
});
