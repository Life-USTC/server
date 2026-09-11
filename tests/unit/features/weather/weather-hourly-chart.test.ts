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
  it("maps temperatures across the full width and shared plot area", () => {
    const g = buildHourlyChartGeometry(hours, { width: 600 });
    expect(g.points).toHaveLength(4);
    // coldest hour (23) sits lowest on screen = largest y within the plot
    const yByTemp = g.points.map((p) => [p.temperature, p.y] as const);
    const y23 = yByTemp.find(([t]) => t === 23)?.[1] ?? -1;
    const y28 = yByTemp.find(([t]) => t === 28)?.[1] ?? -1;
    expect(y23).toBeLessThanOrEqual(g.tempBaselineY);
    expect(y28).toBeGreaterThanOrEqual(0);
    expect(y23).toBeGreaterThan(y28);
    // x positions use the full available width
    expect(g.points[0].x).toBe(0);
    expect(g.points[3].x).toBe(600);
    expect(g.points[1].x).toBeGreaterThan(g.points[0].x);
  });

  it("emits smooth temp and area paths", () => {
    const g = buildHourlyChartGeometry(hours, { width: 600 });
    expect(g.tempPath.startsWith("M")).toBe(true);
    expect(g.tempPath).toContain("C");
    expect(g.areaPath.startsWith("M")).toBe(true);
    expect(g.areaPath.endsWith("Z")).toBe(true);
  });

  it("scales precipitation bars by probability on the shared baseline", () => {
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
      expect(bar.y + bar.height).toBe(g.tempBaselineY);
      expect(bar.x).toBeGreaterThanOrEqual(0);
      expect(bar.x + bar.width).toBeLessThanOrEqual(g.width);
    }
  });

  it("maps zero and full probability to the shared plot bounds", () => {
    const g = buildHourlyChartGeometry(
      [
        {
          at: "2026-09-02T00:00:00+08:00",
          temperature: 24,
          precipitationProbability: 0,
        },
        {
          at: "2026-09-02T01:00:00+08:00",
          temperature: 25,
          precipitationProbability: 100,
        },
        {
          at: "2026-09-02T02:00:00+08:00",
          temperature: 26,
          precipitationProbability: 150,
        },
        {
          at: "2026-09-02T03:00:00+08:00",
          temperature: 27,
          precipitationProbability: -10,
        },
      ],
      { width: 200 },
    );
    const [zero, full, clampedFull, clampedZero] = g.bars;
    expect(zero.height).toBe(0);
    expect(zero.y).toBe(g.tempBaselineY);
    expect(full.height).toBe(g.tempBaselineY - 16);
    expect(full.y).toBe(16);
    expect(clampedFull).toMatchObject({
      height: full.height,
      y: full.y,
      probability: 100,
    });
    expect(clampedZero).toMatchObject({
      height: 0,
      y: g.tempBaselineY,
      probability: 0,
    });
  });

  it("handles flat temperatures without dividing by zero", () => {
    const flat = [
      { at: "2026-09-02T00:00:00+08:00", temperature: 25 },
      { at: "2026-09-02T01:00:00+08:00", temperature: 25 },
    ];
    const g = buildHourlyChartGeometry(flat, { width: 300 });
    expect(g.points.every((p) => Number.isFinite(p.y))).toBe(true);
    expect(g.points.every((p) => p.y >= 16 && p.y <= g.tempBaselineY)).toBe(
      true,
    );
  });

  it("handles empty and single-point input", () => {
    const empty = buildHourlyChartGeometry([], { width: 300 });
    expect(empty.points).toEqual([]);
    expect(empty.tempPath).toBe("");
    expect(empty.areaPath).toBe("");
    expect(empty.bars).toEqual([]);
    expect(empty.xLabels).toEqual([]);

    const single = buildHourlyChartGeometry([hours[0]], { width: 300 });
    expect(single.points).toHaveLength(1);
    expect(single.points[0].x).toBe(150);
    expect(single.tempPath.startsWith("M")).toBe(true);
    expect(single.areaPath.endsWith("Z")).toBe(true);
    expect(single.bars[0].y + single.bars[0].height).toBe(single.tempBaselineY);
    expect(single.bars[0].x).toBeGreaterThanOrEqual(0);
    expect(single.bars[0].x + single.bars[0].width).toBeLessThanOrEqual(
      single.width,
    );
    expect(single.xLabels).toEqual([{ x: 150, label: "00:00" }]);
  });

  it("uses responsive labels, keeps both endpoints, and formats Shanghai time", () => {
    const many = Array.from({ length: 24 }, (_, i) => ({
      at: new Date(Date.UTC(2026, 8, 1, 16 + i)).toISOString(),
      temperature: 20 + (i % 5),
    }));
    const g = buildHourlyChartGeometry(many, { width: 600 });
    expect(g.xLabels).toHaveLength(9);
    expect(g.xLabels[0]).toEqual({ x: 0, label: "00:00" });
    expect(g.xLabels.at(-1)).toEqual({ x: 600, label: "23:00" });
    expect(g.xLabels.every((label) => label.x >= 0 && label.x <= 600)).toBe(
      true,
    );

    const narrow = buildHourlyChartGeometry(many, { width: 140 });
    expect(narrow.xLabels).toHaveLength(3);
    expect(narrow.xLabels[0]).toEqual({ x: 0, label: "00:00" });
    expect(narrow.xLabels.at(-1)).toEqual({ x: 140, label: "23:00" });
    expect(narrow.points[0].x).toBe(0);
    expect(narrow.points.at(-1)?.x).toBe(140);
    for (const bar of narrow.bars) {
      expect(bar.x).toBeGreaterThanOrEqual(0);
      expect(bar.x + bar.width).toBeLessThanOrEqual(narrow.width);
    }
  });
});
