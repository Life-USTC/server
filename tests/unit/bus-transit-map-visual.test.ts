import { describe, expect, test } from "vitest";
import {
  estimateCampusLabelWidth,
  labelOffset,
} from "@/features/bus/components/bus-transit-map-visual";

describe("校车线路图标签布局", () => {
  test("西侧高新与先研院标签向图内侧展开避免裁切", () => {
    expect(labelOffset({ x: 80, y: 260 }, "先研院")).toEqual({
      dx: 48,
      dy: 8,
      textAnchor: "start",
    });
    expect(labelOffset({ x: 80, y: 380 }, "高新")).toEqual({
      dx: 48,
      dy: 8,
      textAnchor: "start",
    });
  });

  test("东侧校区标签向右展开", () => {
    expect(labelOffset({ x: 820, y: 240 }, "东区")).toEqual({
      dx: 48,
      dy: 8,
      textAnchor: "start",
    });
    expect(labelOffset({ x: 840, y: 360 }, "南区")).toEqual({
      dx: 48,
      dy: 8,
      textAnchor: "start",
    });
  });

  test("标签宽度估算覆盖中文笔画", () => {
    expect(estimateCampusLabelWidth("先研院")).toBe(3 * 28 + 8);
  });
});
