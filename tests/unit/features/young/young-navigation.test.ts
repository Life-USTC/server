import { describe, expect, it } from "vitest";
import {
  removeYoungFilter,
  youngDetailHref,
} from "@/features/young/lib/young-navigation";

const url = (path: string) => new URL(path, "https://life.test");

describe("young catalog browse context", () => {
  it("uses one query-free detail URL with an encoded event identity", () => {
    const detail = url(youngDetailHref("A / B"));
    expect(detail.pathname).toBe("/catalog/young-events/A%20%2F%20B");
    expect(detail.search).toBe("");
    expect(detail.hash).toBe("");
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
});
