import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SAMPLE_GEO_DATA = {
  locations: [
    { name: "Library", latitude: 31.842, longitude: 117.262 },
    { name: "East Campus Gate", latitude: 31.841, longitude: 117.265 },
    { name: "Science Building", latitude: 31.843, longitude: 117.263 },
  ],
};

const SAMPLE_BUILDING_RULES = [
  { regex: "5\\d{3}", path: "./imgs/teaching_building_5.jpg" },
  { regex: "3[ABC]\\d{3}", path: "./imgs/building_3.jpg" },
  { regex: "LIB\\d+", path: "./imgs/library.jpg" },
];

describe("location-utils", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mockStaticFiles({
    geoData = SAMPLE_GEO_DATA,
    buildingRules = SAMPLE_BUILDING_RULES,
  }: {
    geoData?: typeof SAMPLE_GEO_DATA;
    buildingRules?: typeof SAMPLE_BUILDING_RULES;
  } = {}) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const href = url.toString();
        if (href.endsWith("/geo_data.json")) {
          return new Response(JSON.stringify(geoData), { status: 200 });
        }
        if (href.endsWith("/building_img_rules.json")) {
          return new Response(JSON.stringify(buildingRules), { status: 200 });
        }
        return new Response("not found", { status: 404 });
      }),
    );
  }

  describe("getLocationGeo", () => {
    it("returns null for empty string", async () => {
      const { getLocationGeo } = await import(
        "@/shared/lib/location/location-utils"
      );
      const result = await getLocationGeo("");
      expect(result).toBeNull();
    });

    it("finds exact match (case-insensitive)", async () => {
      mockStaticFiles();
      const { getLocationGeo } = await import(
        "@/shared/lib/location/location-utils"
      );
      const result = await getLocationGeo("library");
      expect(result).toEqual({
        name: "Library",
        latitude: 31.842,
        longitude: 117.262,
      });
    });

    it("finds exact match with different casing", async () => {
      mockStaticFiles();
      const { getLocationGeo } = await import(
        "@/shared/lib/location/location-utils"
      );
      const result = await getLocationGeo("SCIENCE BUILDING");
      expect(result).toEqual({
        name: "Science Building",
        latitude: 31.843,
        longitude: 117.263,
      });
    });

    it("falls back to starts-with match", async () => {
      mockStaticFiles();
      const { getLocationGeo } = await import(
        "@/shared/lib/location/location-utils"
      );
      const result = await getLocationGeo("East Campus Gate Room 101");
      expect(result).toEqual({
        name: "East Campus Gate",
        latitude: 31.841,
        longitude: 117.265,
      });
    });

    it("returns null when no match is found", async () => {
      mockStaticFiles();
      const { getLocationGeo } = await import(
        "@/shared/lib/location/location-utils"
      );
      const result = await getLocationGeo("Nonexistent Place");
      expect(result).toBeNull();
    });

    it("returns null when published geo data is unavailable", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("not found", { status: 404 })),
      );
      const { getLocationGeo } = await import(
        "@/shared/lib/location/location-utils"
      );
      const result = await getLocationGeo("Library");
      expect(result).toBeNull();
    });

    it("logs and omits enrichment when published geo JSON is invalid", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("{bad-json", { status: 200 })),
      );

      const { getLocationGeo } = await import(
        "@/shared/lib/location/location-utils"
      );
      const result = await getLocationGeo("Library");

      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("getBuildingImagePath", () => {
    it("returns null for empty string", async () => {
      const { getBuildingImagePath } = await import(
        "@/shared/lib/location/location-utils"
      );
      const result = await getBuildingImagePath("");
      expect(result).toBeNull();
    });

    it("matches regex rules and builds a URL from the published static host", async () => {
      mockStaticFiles();
      const { getBuildingImagePath } = await import(
        "@/shared/lib/location/location-utils"
      );
      const result = await getBuildingImagePath("5101");
      expect(result).toBe(
        "https://static.life-ustc.tiankaima.dev/imgs/teaching_building_5.jpg",
      );
    });

    it("uses the published static host for relative building image rules", async () => {
      mockStaticFiles();
      const { getBuildingImagePath } = await import(
        "@/shared/lib/location/location-utils"
      );
      const result = await getBuildingImagePath("3A201");
      expect(result).toBe(
        "https://static.life-ustc.tiankaima.dev/imgs/building_3.jpg",
      );
    });

    it("preserves absolute image URLs", async () => {
      mockStaticFiles({
        buildingRules: [
          { regex: "5101", path: "https://cdn.example.com/5101.jpg" },
        ],
      });
      const { getBuildingImagePath } = await import(
        "@/shared/lib/location/location-utils"
      );
      const result = await getBuildingImagePath("5101");
      expect(result).toBe("https://cdn.example.com/5101.jpg");
    });

    it("returns null when no regex matches", async () => {
      mockStaticFiles();
      const { getBuildingImagePath } = await import(
        "@/shared/lib/location/location-utils"
      );
      const result = await getBuildingImagePath("UNKNOWN_CODE");
      expect(result).toBeNull();
    });
  });
});
