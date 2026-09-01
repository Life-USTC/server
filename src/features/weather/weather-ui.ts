/**
 * Presentation helpers for the weather page: condition → Lucide icon mapping
 * and iOS-style daily temperature range bar positions.
 */

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
