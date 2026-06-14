import { describe, expect, it } from "vitest";
import { LOCALE_COOKIE } from "@/i18n/config";
import { getRequestLocale } from "@/lib/api/routes/request-locale";

describe("getRequestLocale", () => {
  it("ignores malformed locale cookie values", () => {
    const request = new Request("https://life.example/api/bus", {
      headers: {
        "accept-language": "en-US,en;q=0.9",
        cookie: `${LOCALE_COOKIE}=%`,
      },
    });

    expect(getRequestLocale(request)).toBe("en-us");
  });
});
