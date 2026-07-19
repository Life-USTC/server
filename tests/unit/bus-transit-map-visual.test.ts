import { describe, expect, test } from "vitest";
import { labelOffset } from "@/features/bus/components/bus-transit-map-visual";

describe("校车线路图标签布局", () => {
  test("底部相邻校区标签向图外侧展开", () => {
    expect(labelOffset({ x: 380, y: 460 }, "高新")).toEqual({
      dx: -36,
      dy: 6,
      textAnchor: "end",
    });
    expect(labelOffset({ x: 482, y: 460 }, "先研院")).toEqual({
      dx: 36,
      dy: 6,
      textAnchor: "start",
    });
  });

  test("顶部校区保留既有方向提示", () => {
    expect(labelOffset({ x: 473, y: 100 }, "东区")).toEqual({
      dx: 36,
      dy: 6,
      textAnchor: "start",
    });
    expect(labelOffset({ x: 379, y: 131 }, "南区")).toEqual({
      dx: -36,
      dy: 6,
      textAnchor: "end",
    });
  });
});
