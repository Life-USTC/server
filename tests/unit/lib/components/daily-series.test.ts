import { describe, expect, it } from "vitest";
import {
  buildDailySeriesGeometry,
  nearestDailySeriesIndex,
} from "@/lib/components/charts/daily-series";

describe("daily series chart geometry", () => {
  it("keeps zero values and breaks paths across null observations", () => {
    const geometry = buildDailySeriesGeometry(
      ["2026-09-12", "2026-09-13", "2026-09-14"],
      [{ key: "reads", label: "Reads", values: [0, null, 3] }],
      { width: 300 },
    );

    expect(geometry.yMax).toBe(3);
    expect(geometry.paths[0]?.points).toHaveLength(2);
    expect(geometry.paths[0]?.points[0]?.value).toBe(0);
    expect(geometry.paths[0]?.path.match(/M/g)).toHaveLength(2);
    expect(geometry.paths[0]?.path).not.toContain(" L");
  });

  it("bounds point inspection to the first and last day", () => {
    expect(nearestDailySeriesIndex(0, 4, 300)).toBe(0);
    expect(nearestDailySeriesIndex(299, 4, 300)).toBe(3);
    expect(nearestDailySeriesIndex(150, 4, 300)).toBe(1);
    expect(nearestDailySeriesIndex(150, 0, 300)).toBe(0);
  });

  it("uses an honest baseline when all values are empty", () => {
    const geometry = buildDailySeriesGeometry(
      ["2026-09-14"],
      [{ key: "reads", label: "Reads", values: [null] }],
    );

    expect(geometry.yMax).toBe(1);
    expect(geometry.paths[0]?.points).toEqual([]);
  });
});
