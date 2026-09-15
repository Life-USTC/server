import { describe, expect, it } from "vitest";
import {
  formatRoomMapCopy,
  isRoomMapResult,
  splitRoomLabels,
} from "@/features/rooms/lib/room-map-types";

describe("room map display helpers", () => {
  it("formats room placeholders and splits duplicate room labels", () => {
    expect(formatRoomMapCopy("Map for {code}", "3A204")).toBe("Map for 3A204");
    expect(splitRoomLabels("3A204, 1101、 3A204；2A101")).toEqual([
      "3A204",
      "1101",
      "2A101",
    ]);
  });

  it("accepts the planned response shape and rejects incomplete payloads", () => {
    expect(
      isRoomMapResult({
        building: "一教",
        code: "3A204",
        floor: "1",
        imageUrl: "/maps/one-101.png",
        sourceImageUrl: "/maps/one-floor-1.png",
        status: "highlighted",
      }),
    ).toBe(true);
    expect(
      isRoomMapResult({
        building: null,
        code: "1101",
        floor: null,
        imageUrl: null,
        sourceImageUrl: null,
        status: "overview",
      }),
    ).toBe(true);
    expect(isRoomMapResult({ code: "3A204", status: "unknown" })).toBe(false);
  });
});
