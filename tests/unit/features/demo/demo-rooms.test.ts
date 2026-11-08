import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  getDemoRoomMap,
  getDemoRoomMapAsset,
  getDemoRoomMapCopy,
  getDemoRoomMapDirectory,
} from "@/features/demo/server/demo-rooms";
import { roomMapSchema } from "@/features/rooms/server/room-map-schema";

const assets = [
  [
    "demo-floor.svg",
    1371,
    "aedc6d46f4423a609b0ef5ba81e17b90f05aa740351e9d3847e5c2ca8733ee77",
  ],
  [
    "demo-room-101.svg",
    1378,
    "12a4b4a734f2aebf1809300fab11dabbf8383e29546fbdd272e780883f621ec9",
  ],
] as const;

describe("closed fictional Demo room diagrams", () => {
  for (const locale of ["en-us", "zh-cn"] as const) {
    it(`keeps the directory and highlighted room consistent in ${locale}`, () => {
      const building =
        locale === "en-us" ? "Fictional teaching building" : "虚构教学楼";
      expect(getDemoRoomMapDirectory(locale)).toEqual([
        {
          building,
          campus:
            locale === "en-us" ? "Fictional sample campus" : "虚构样例校区",
          floors: [{ floor: "1", codes: ["DEMO-101"] }],
          roomCount: 1,
        },
      ]);
      const map = getDemoRoomMap("DEMO-101", locale);
      expect(map).toEqual({
        code: "DEMO-101",
        building,
        floor: "1",
        status: "highlighted",
        imageUrl: "/api/catalog/rooms/images/demo-room-101.svg",
        sourceImageUrl: "/api/catalog/rooms/images/demo-floor.svg",
      });
      expect(roomMapSchema.parse(map)).toEqual(map);
      const copy = getDemoRoomMapCopy(locale);
      expect(copy.sampleRooms).toEqual(["DEMO-101", "DEMO-1", "DEMO-NONE"]);
      expect(copy.subtitle).toMatch(
        locale === "en-us" ? /Fictional.*not.*actual/ : /虚构.*不代表.*真实/,
      );
    });

    it(`keeps overview and unavailable facts distinct in ${locale}`, () => {
      const overview = getDemoRoomMap("DEMO-1", locale);
      expect(overview).toEqual({
        code: "DEMO-1",
        building: null,
        floor: null,
        status: "overview",
        imageUrl: "/api/catalog/rooms/images/demo-floor.svg",
        sourceImageUrl: "/api/catalog/rooms/images/demo-floor.svg",
      });
      const missing = getDemoRoomMap("DEMO-NONE", locale);
      expect(missing).toEqual({
        code: "DEMO-NONE",
        building: null,
        floor: null,
        status: "unavailable",
        imageUrl: null,
        sourceImageUrl: null,
      });
      for (const map of [overview, missing])
        expect(roomMapSchema.parse(map)).toEqual(map);
    });
  }

  it("uses original code normalization without inferring neighboring rooms", () => {
    expect(getDemoRoomMap(" \tｄｅｍｏ－１０１\n ", "en-us")).toEqual(
      getDemoRoomMap("DEMO-101", "en-us"),
    );
    expect(getDemoRoomMap("demo-1")).toEqual(getDemoRoomMap("DEMO-1"));
    for (const code of ["Ⅷ".repeat(17), "ﬄ".repeat(22)])
      expect(getDemoRoomMap(code), code).toBeNull();
    for (const code of ["1A101", "DEMO-102", "DEMO-101-1", "DEMO-999"])
      expect(getDemoRoomMap(code), code).toBeNull();
    for (const code of ["", "DEMO_101", "DEMO-101/../DEMO-1", "A".repeat(65)])
      expect(() => getDemoRoomMap(code), code).toThrow();
  });

  it("serves only the two exact local diagrams with stable safe bytes", () => {
    for (const [name, size, hash] of assets) {
      const asset = getDemoRoomMapAsset(name);
      expect(asset).not.toBeNull();
      if (!asset) throw new Error("Expected a known local diagram");
      expect(asset.contentType).toBe("image/svg+xml");
      expect(asset.bytes.byteLength).toBe(size);
      expect(asset.sha256).toBe(hash);
      expect(createHash("sha256").update(asset.bytes).digest("hex")).toBe(hash);
      const svg = new TextDecoder().decode(asset.bytes);
      expect(svg).toContain('viewBox="0 0 640 360"');
      expect(svg).toContain("DEMO-101");
      expect(svg).toContain("FICTIONAL SCHEMATIC");
      expect(svg).toContain("非学校实际布局");
      expect(svg).not.toMatch(
        /<(?:script|foreignObject)\b|\bon\w+\s*=|\bhref\s*=/i,
      );
    }
    for (const name of [
      "",
      "DEMO-FLOOR.SVG",
      "demo-floor.png",
      "../demo-floor.svg",
      "demo-floor.svg?token=private",
      "constructor",
      "__proto__",
    ])
      expect(getDemoRoomMapAsset(name), name).toBeNull();
  });

  it("does not share mutable diagram bytes, directory rows or sample chips", () => {
    const first = getDemoRoomMapAsset("demo-floor.svg");
    if (!first) throw new Error("Expected the fixed floor diagram");
    first.bytes.fill(0);
    const directory = getDemoRoomMapDirectory("en-us");
    const floor = directory[0]?.floors[0];
    if (!floor) throw new Error("Expected the fixed floor");
    floor.codes.push("PRIVATE-ROOM");
    getDemoRoomMapCopy("en-us").sampleRooms.splice(0);
    const next = getDemoRoomMapAsset("demo-floor.svg");
    if (!next) throw new Error("Expected an independent floor diagram");
    expect(createHash("sha256").update(next.bytes).digest("hex")).toBe(
      assets[0][2],
    );
    for (const locale of ["en-us", "zh-cn"] as const) {
      expect(
        getDemoRoomMapDirectory(locale).flatMap((building) =>
          building.floors.flatMap((row) => row.codes),
        ),
      ).toEqual(["DEMO-101"]);
      expect(getDemoRoomMapCopy(locale).sampleRooms).toEqual([
        "DEMO-101",
        "DEMO-1",
        "DEMO-NONE",
      ]);
    }
  });
});
