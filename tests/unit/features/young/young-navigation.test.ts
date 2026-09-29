import { describe, expect, it } from "vitest";
import {
  removeYoungFilter,
  youngDetailHref,
  youngReturnHref,
} from "@/features/young/lib/young-navigation";

const url = (path: string) => new URL(path, "https://life.test");

describe("young catalog browse context", () => {
  it("returns from a detail to the exact originating browse page, including pagination", () => {
    const browse = url("/catalog/young-events?category=sport&page=3");
    const detail = url(youngDetailHref("A / B", browse));
    expect(detail.pathname).toBe("/catalog/young-events/A%20%2F%20B");
    expect(youngReturnHref(detail.searchParams.get("returnTo"))).toBe(
      browse.pathname + browse.search,
    );
  });
  it("removes one filter and resets pagination, leaving other conditions intact", () => {
    const result = url(
      removeYoungFilter(
        url("/catalog/young-events?category=sport&active=true&page=7"),
        "category",
      ),
    );
    expect(result.search).toBe("?active=true");
    expect(
      removeYoungFilter(
        url(
          "/catalog/young-events?dateUnknown=true&timeBasis=registration&page=2",
        ),
        "dateUnknown",
      ),
    ).toBe("/catalog/young-events");
  });
  it("rejects noncatalog and external return destinations", () => {
    for (const target of [
      null,
      "https://evil.test",
      "//evil.test",
      "/account/settings",
      "/catalog/young-events/../../account",
      "/catalog/young-events/42",
      "/catalog/young-events-extra",
    ]) {
      expect(youngReturnHref(target)).toBe("/catalog/young-events");
    }
  });
});
