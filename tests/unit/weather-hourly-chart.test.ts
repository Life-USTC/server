import { describe, expect, it } from "vitest";
import { buildHourlyChartGeometry } from "@/features/weather/weather-ui";

const hours = [
  {
    at: "2026-09-02T00:00:00+08:00",
    temperature: 24,
    precipitationProbability: 80,
  },
  {
    at: "2026-09-02T01:00:00+08:00",
    temperature: 23,
    precipitationProbability: 60,
  },
  {
    at: "2026-09-02T02:00:00+08:00",
    temperature: 26,
    precipitationProbability: 0,
  },
  { at: "2026-09-02T03:00:00+08:00", temperature: 28 },
];

describe("buildHourlyChartGeometry", () => {
  it("maps temperatures into the chart area with padding", () => {
    const g = buildHourlyChartGeometry(hours, { width: 600 });
    expect(g.points).toHaveLength(4);
    // coldest hour (23) sits lowest on screen = largest y within the temp band
    const yByTemp = g.points.map((p) => [p.temperature, p.y] as const);
    const y23 = yByTemp.find(([t]) => t === 23)?.[1] ?? -1;
    const y28 = yByTemp.find(([t]) => t === 28)?.[1] ?? -1;
    expect(y23).toBeGreaterThanOrEqual(0);
    expect(y28).toBeGreaterThanOrEqual(0);
    expect(y23).toBeGreaterThan(y28);
    // x positions spread across the width and stay in bounds
    expect(g.points[0].x).toBeGreaterThan(0);
    expect(g.points[3].x).toBeLessThan(600);
    expect(g.points[1].x).toBeGreaterThan(g.points[0].x);
  });

  it("emits smooth temp and area paths", () => {
    const g = buildHourlyChartGeometry(hours, { width: 600 });
    expect(g.tempPath.startsWith("M")).toBe(true);
    expect(g.tempPath).toContain("C");
    expect(g.areaPath.startsWith("M")).toBe(true);
    expect(g.areaPath.endsWith("Z")).toBe(true);
  });

  it("scales precipitation bars by probability", () => {
    const g = buildHourlyChartGeometry(hours, { width: 600 });
    expect(g.bars).toHaveLength(4);
    const b80 = g.bars[0];
    const b60 = g.bars[1];
    const b0 = g.bars[2];
    const bNone = g.bars[3];
    expect(b80.height).toBeGreaterThan(b60.height);
    expect(b0.height).toBe(0);
    expect(bNone.height).toBe(0);
    for (const bar of g.bars) {
      expect(bar.y + bar.height).toBeLessThanOrEqual(g.height);
    }
  });

  it("handles flat temperatures without dividing by zero", () => {
    const flat = [
      { at: "2026-09-02T00:00:00+08:00", temperature: 25 },
      { at: "2026-09-02T01:00:00+08:00", temperature: 25 },
    ];
    const g = buildHourlyChartGeometry(flat, { width: 300 });
    expect(g.points.every((p) => Number.isFinite(p.y))).toBe(true);
  });

  it("handles empty and single-point input", () => {
    const empty = buildHourlyChartGeometry([], { width: 300 });
    expect(empty.points).toEqual([]);
    expect(empty.tempPath).toBe("");
    const single = buildHourlyChartGeometry([hours[0]], { width: 300 });
    expect(single.points).toHaveLength(1);
    expect(single.tempPath.startsWith("M")).toBe(true);
  });

  it("places sparse x-axis hour labels", () => {
    const many = Array.from({ length: 24 }, (_, i) => ({
      at: `2026-09-02T${String(i).padStart(2, "0")}:00:00+08:00`,
      temperature: 20 + (i % 5),
    }));
    const g = buildHourlyChartGeometry(many, { width: 600 });
    expect(g.xLabels.length).toBeGreaterThanOrEqual(3);
    expect(g.xLabels.length).toBeLessThanOrEqual(9);
    expect(g.xLabels[0].label).toBe("00:00");
  });
});
