import { describe, expect, it } from "vitest";
import {
  normalizeCampusIdentity,
  resolveSectionCampusDatabaseId,
} from "@/static-loader/campus-identity";

describe("static campus identity", () => {
  it("keeps a conflicting catalog campus as name-only", () => {
    const names = new Map([[102, "太湖路校区"]]);

    expect(
      normalizeCampusIdentity(
        { jwId: 102, nameCn: "高新区", nameEn: "High-tech Campus" },
        names,
      ),
    ).toEqual({
      jwId: undefined,
      nameCn: "高新区",
      nameEn: "High-tech Campus",
    });
    expect(names).toEqual(new Map([[102, "太湖路校区"]]));
  });

  it("retains a matching campus ID and records new identities", () => {
    const names = new Map<number, string>();
    const campus = { jwId: 102, nameCn: "太湖路校区" };

    expect(normalizeCampusIdentity(campus, names)).toBe(campus);
    expect(names).toEqual(new Map([[102, "太湖路校区"]]));
  });

  it("prefers the catalog name when section ID and name disagree", () => {
    expect(
      resolveSectionCampusDatabaseId(
        { campusId: 102, campusName: "高新区" },
        {
          byJwId: new Map([[102, 1]]),
          byName: new Map([
            ["太湖路校区", 1],
            ["高新区", 2],
          ]),
        },
      ),
    ).toBe(2);
  });
});
