/**
 * Presentation helpers for the weather page: condition → Lucide icon mapping
 * and iOS-style daily temperature range bar positions.
 */

import { formatShanghaiTime } from "@/lib/time/shanghai-format";

export type WeatherConditionInput = {
  text: string;
  icon: string;
};

/** Lucide icon names used by the weather page. */
export type WeatherIconName =
  | "sun"
  | "cloud-sun"
  | "cloud"
  | "cloudy"
  | "cloud-fog"
  | "cloud-drizzle"
  | "cloud-rain"
  | "cloud-snow"
  | "cloud-hail"
  | "cloud-lightning";

function wmoIcon(icon: string): WeatherIconName | undefined {
  const match = /^wmo-(\d+)$/.exec(icon);
  if (!match) return undefined;
  const code = Number(match[1]);
  if (code === 0 || code === 1) return "sun";
  if (code === 2) return "cloud-sun";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "cloud-fog";
  if (code >= 51 && code <= 57) return "cloud-drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return "cloud-rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return "cloud-snow";
  if (code >= 95 && code <= 99) return "cloud-lightning";
  return undefined;
}

function textIcon(text: string): WeatherIconName | undefined {
  if (text.includes("雷")) return "cloud-lightning";
  if (text.includes("冰雹")) return "cloud-hail";
  if (text.includes("雪")) return "cloud-snow";
  if (text.includes("毛毛雨") || text.includes("阵雨")) return "cloud-drizzle";
  if (text.includes("雨")) return "cloud-rain";
  if (text.includes("雾") || text.includes("霾")) return "cloud-fog";
  if (text.includes("阴")) return "cloudy";
  if (text.includes("多云")) return "cloud-sun";
  if (text.includes("晴")) return "sun";
  return undefined;
}

export function weatherConditionIcon(
  condition: WeatherConditionInput,
): WeatherIconName {
  return (
    wmoIcon(condition.icon) ?? textIcon(condition.text) ?? ("cloud" as const)
  );
}

export type TemperatureRangePosition = {
  /** Left offset within the overall range, in percent. */
  left: number;
  /** Width within the overall range, in percent. */
  width: number;
};

/**
 * Positions each day's low–high range inside the overall weekly range,
 * iOS Weather style. Percent values, rounded to one decimal.
 */
export function temperatureRangePositions(
  days: Array<{ low: number; high: number }>,
): TemperatureRangePosition[] {
  if (days.length === 0) return [];
  const min = Math.min(...days.map((d) => d.low));
  const max = Math.max(...days.map((d) => d.high));
  const span = max - min;
  if (span === 0) return days.map(() => ({ left: 0, width: 100 }));
  return days.map((d) => ({
    left: Math.round(((d.low - min) / span) * 1000) / 10,
    width: Math.round(((d.high - d.low) / span) * 1000) / 10,
  }));
}

export type HourlyChartDatum = {
  at: string;
  temperature: number;
  precipitationProbability?: number;
};

export type HourlyChartPoint = {
  x: number;
  y: number;
  temperature: number;
};

export type HourlyChartBar = {
  x: number;
  y: number;
  width: number;
  height: number;
  probability: number;
};

export type HourlyChartLabel = {
  x: number;
  label: string;
};

export type HourlyChartGeometry = {
  width: number;
  height: number;
  /** Y of the shared baseline for the temperature curve and precipitation bars. */
  tempBaselineY: number;
  points: HourlyChartPoint[];
  tempPath: string;
  areaPath: string;
  bars: HourlyChartBar[];
  xLabels: HourlyChartLabel[];
};

const CHART_PAD_TOP = 16;
const CHART_PLOT_HEIGHT = 128;
const CHART_LABEL_H = 20;
const CHART_PAD_BOTTOM = 4;
const CHART_HEIGHT =
  CHART_PAD_TOP + CHART_PLOT_HEIGHT + CHART_LABEL_H + CHART_PAD_BOTTOM;
const CHART_LABEL_SPACING = 70;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function labelIndices(dataLength: number, width: number): number[] {
  if (dataLength === 0) return [];
  if (dataLength === 1) return [0];

  const labelCount = Math.min(
    dataLength,
    Math.max(2, Math.floor(width / CHART_LABEL_SPACING) + 1),
  );
  return Array.from({ length: labelCount }, (_, index) =>
    Math.round((index * (dataLength - 1)) / (labelCount - 1)),
  );
}

/** Catmull-Rom spline converted to cubic Bézier segments. */
function smoothPath(points: HourlyChartPoint[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  let path = `M${round1(first.x)},${round1(first.y)}`;
  if (points.length === 1) return path;
  for (let i = 0; i < rest.length; i++) {
    const p0 = points[i - 1] ?? first;
    const p1 = points[i];
    const p2 = rest[i];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path +=
      `C${round1(c1x)},${round1(c1y)} ` +
      `${round1(c2x)},${round1(c2y)} ` +
      `${round1(p2.x)},${round1(p2.y)}`;
  }
  return path;
}

/**
 * Geometry for the hourly temperature curve + precipitation bar chart.
 * Pure SVG-space math so the component stays declarative.
 */
export function buildHourlyChartGeometry(
  data: HourlyChartDatum[],
  { width }: { width: number },
): HourlyChartGeometry {
  const chartWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const tempBaselineY = CHART_PAD_TOP + CHART_PLOT_HEIGHT;
  const empty: HourlyChartGeometry = {
    width: chartWidth,
    height: CHART_HEIGHT,
    tempBaselineY,
    points: [],
    tempPath: "",
    areaPath: "",
    bars: [],
    xLabels: [],
  };
  if (data.length === 0) return empty;

  const temps = data.map((d) => d.temperature);
  const lo = Math.min(...temps) - 1;
  const hi = Math.max(...temps) + 1;
  const span = hi - lo || 1;
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : 0;
  const xAt = (i: number) => (data.length > 1 ? i * stepX : chartWidth / 2);

  const points = data.map((d, i) => ({
    x: round1(xAt(i)),
    y: round1(
      CHART_PAD_TOP + (1 - (d.temperature - lo) / span) * CHART_PLOT_HEIGHT,
    ),
    temperature: d.temperature,
  }));

  const tempPath = smoothPath(points);
  const areaPath = tempPath
    ? `${tempPath}L${round1(points[points.length - 1].x)},${tempBaselineY}` +
      `L${round1(points[0].x)},${tempBaselineY}Z`
    : "";

  const barWidth = round1(Math.min(24, (chartWidth / data.length) * 0.5));
  const bars = data.map((d, i) => {
    const probability = clamp(
      Number.isFinite(d.precipitationProbability ?? 0)
        ? (d.precipitationProbability ?? 0)
        : 0,
      0,
      100,
    );
    const height = round1((probability / 100) * CHART_PLOT_HEIGHT);
    const x = clamp(
      xAt(i) - barWidth / 2,
      0,
      Math.max(0, chartWidth - barWidth),
    );
    return {
      x: round1(x),
      y: round1(tempBaselineY - height),
      width: barWidth,
      height,
      probability,
    };
  });

  const indices = labelIndices(data.length, chartWidth);
  const xLabels = indices.map((i) => ({
    x: round1(xAt(i)),
    label: formatShanghaiTime(data[i].at),
  }));

  return {
    width: chartWidth,
    height: CHART_HEIGHT,
    tempBaselineY,
    points,
    tempPath,
    areaPath,
    bars,
    xLabels,
  };
}
