import { describe, expect, test } from "vitest";
import {
  CAMPUS_LABEL_FONT_PX,
  CAMPUS_LABEL_FONT_PX_DESKTOP,
  NODE_R,
} from "@/features/bus/components/bus-transit-map-constants";
import {
  estimateCampusLabelWidth,
  labelOffset,
} from "@/features/bus/components/bus-transit-map-visual";

describe("校车线路图标签布局", () => {
  test("节点半径约为历史值的一半", () => {
    expect(NODE_R).toBe(14);
    expect(CAMPUS_LABEL_FONT_PX_DESKTOP).toBe(14);
    expect(CAMPUS_LABEL_FONT_PX).toBe(28);
  });

  test("西侧高新与先研院标签向图内侧展开避免裁切", () => {
    expect(labelOffset({ x: 80, y: 260 }, "先研院")).toEqual({
      dx: NODE_R + 12,
      dy: 6,
      textAnchor: "start",
    });
    expect(labelOffset({ x: 80, y: 380 }, "高新")).toEqual({
      dx: NODE_R + 12,
      dy: 6,
      textAnchor: "start",
    });
  });

  test("东侧校区标签向右展开", () => {
    expect(labelOffset({ x: 820, y: 240 }, "东区")).toEqual({
      dx: NODE_R + 12,
      dy: 6,
      textAnchor: "start",
    });
    expect(labelOffset({ x: 840, y: 360 }, "南区")).toEqual({
      dx: NODE_R + 12,
      dy: 6,
      textAnchor: "start",
    });
  });

  test("标签宽度估算覆盖中文笔画（按移动端字号预留）", () => {
    expect(estimateCampusLabelWidth("先研院")).toBe(
      3 * CAMPUS_LABEL_FONT_PX + 8,
    );
  });
});
