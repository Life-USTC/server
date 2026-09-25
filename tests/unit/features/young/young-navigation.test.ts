import { describe, expect, it } from "vitest";
import {
  removeYoungFilter,
  youngBrowseHref,
  youngDetailHref,
  youngReturnHref,
} from "@/features/young/lib/young-navigation";

const url = (path: string) => new URL(path, "https://life.test");

describe("young catalog browse context", () => {
  it("keeps every shared filter when switching between list and calendar, without carrying pagination", () => {
    const source = url(
      "/catalog/young-events?search=reading&active=false&module=智&activityLevel=校级&category=lecture&organizerId=club&page=4",
    );
    const calendar = url(youngBrowseHref(source, "calendar"));
    expect(calendar.pathname).toBe("/catalog/young-events/calendar");
    expect(calendar.searchParams.get("page")).toBeNull();
    for (const [key, value] of source.searchParams) {
      if (key !== "page") expect(calendar.searchParams.get(key)).toBe(value);
    }
    expect(youngBrowseHref(calendar, "events")).toBe(
      `/catalog/young-events${calendar.search}`,
    );
  });
  it("returns from a detail to the exact originating browse page, including pagination", () => {
    const browse = url("/catalog/young-events?category=sport&page=3");
    const detail = url(youngDetailHref("A / B", browse));
    expect(detail.pathname).toBe("/catalog/young-events/A%20%2F%20B");
    expect(youngReturnHref(detail.searchParams.get("returnTo"))).toBe(
      browse.pathname + browse.search,
    );
    expect(youngBrowseHref(detail, "calendar")).toBe(
      "/catalog/young-events/calendar?category=sport",
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
  it("does not reinterpret organizer-name search as activity-name search", () => {
    expect(
      youngBrowseHref(
        url("/catalog/young-events/organizers?search=club"),
        "events",
      ),
    ).toBe("/catalog/young-events");
  });
});
