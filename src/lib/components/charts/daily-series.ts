export type DailySeries = {
  key: string;
  label: string;
  values: readonly (number | null)[];
  color?: string;
};

export type DailySeriesPoint = {
  index: number;
  value: number;
  x: number;
  y: number;
};

export type DailySeriesPath = {
  key: string;
  label: string;
  path: string;
  points: DailySeriesPoint[];
};

export type DailySeriesGeometry = {
  height: number;
  plotBottom: number;
  plotTop: number;
  paths: DailySeriesPath[];
  width: number;
  xLabels: Array<{ day: string; index: number; x: number }>;
  yMax: number;
  yTicks: Array<{ value: number; y: number }>;
};

const DEFAULT_HEIGHT = 220;
const PLOT_LEFT = 44;
const PLOT_RIGHT = 12;
const PLOT_TOP = 14;
const PLOT_BOTTOM = 188;
const X_LABEL_COUNT = 7;

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

function pointX(index: number, count: number, width: number) {
  if (count <= 1)
    return PLOT_LEFT + Math.max(0, width - PLOT_LEFT - PLOT_RIGHT) / 2;
  return PLOT_LEFT + (index / (count - 1)) * (width - PLOT_LEFT - PLOT_RIGHT);
}

function pointY(value: number, yMax: number) {
  return PLOT_BOTTOM - (value / yMax) * (PLOT_BOTTOM - PLOT_TOP);
}

export function dailySeriesX(index: number, daysLength: number, width: number) {
  return pointX(index, daysLength, width);
}

function linePath(
  points: DailySeriesPoint[],
  values: readonly (number | null)[],
) {
  let path = "";
  let previous: DailySeriesPoint | null = null;
  const pointsByIndex = new Map(points.map((point) => [point.index, point]));
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === null || value === undefined || !Number.isFinite(value)) {
      previous = null;
      continue;
    }
    const point = pointsByIndex.get(index);
    if (!point) continue;
    path += previous
      ? ` L${rounded(point.x)},${rounded(point.y)}`
      : `M${rounded(point.x)},${rounded(point.y)}`;
    previous = point;
  }
  return path;
}

function xLabelIndices(count: number) {
  if (count === 0) return [];
  if (count <= X_LABEL_COUNT)
    return Array.from({ length: count }, (_, index) => index);
  const indices = Array.from({ length: X_LABEL_COUNT }, (_, index) =>
    Math.round((index * (count - 1)) / (X_LABEL_COUNT - 1)),
  );
  return [...new Set(indices)];
}

/**
 * Build SVG-space geometry for a bounded daily multiseries line chart.
 * Null values create gaps; zero remains a real point on the baseline.
 */
export function buildDailySeriesGeometry(
  days: readonly string[],
  series: readonly DailySeries[],
  options: { height?: number; width?: number } = {},
): DailySeriesGeometry {
  const width = Number.isFinite(options.width)
    ? Math.max(PLOT_LEFT + PLOT_RIGHT, options.width ?? 0)
    : 640;
  const height = options.height ?? DEFAULT_HEIGHT;
  const finiteValues = series.flatMap((item) =>
    item.values.filter((value): value is number => Number.isFinite(value)),
  );
  const yMax = Math.max(1, ...finiteValues, 0);
  const yTicks = [yMax, yMax / 2, 0].map((value) => ({
    value,
    y: pointY(value, yMax),
  }));
  const paths = series.map((item) => {
    const points = item.values.flatMap((value, index) => {
      if (value === null || value === undefined || !Number.isFinite(value))
        return [];
      return [
        {
          index,
          value,
          x: pointX(index, days.length, width),
          y: pointY(Math.max(0, value), yMax),
        },
      ];
    });
    return {
      key: item.key,
      label: item.label,
      path: linePath(points, item.values),
      points,
    };
  });
  const xLabels = xLabelIndices(days.length).map((index) => ({
    day: days[index],
    index,
    x: pointX(index, days.length, width),
  }));

  return {
    height,
    plotBottom: PLOT_BOTTOM,
    plotTop: PLOT_TOP,
    paths,
    width,
    xLabels,
    yMax,
    yTicks,
  };
}

export function nearestDailySeriesIndex(
  x: number,
  daysLength: number,
  width: number,
) {
  if (daysLength <= 1) return 0;
  const plotWidth = width - PLOT_LEFT - PLOT_RIGHT;
  const raw = ((x - PLOT_LEFT) / plotWidth) * (daysLength - 1);
  return Math.max(0, Math.min(daysLength - 1, Math.round(raw)));
}
