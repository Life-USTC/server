import { describe, expect, it } from "vitest";
import {
  temperatureRangePositions,
  weatherConditionIcon,
} from "@/features/weather/weather-ui";

describe("weatherConditionIcon", () => {
  it("maps WMO codes to icons", () => {
    expect(weatherConditionIcon({ text: "晴", icon: "wmo-0" })).toBe("sun");
    expect(weatherConditionIcon({ text: "多云", icon: "wmo-2" })).toBe(
      "cloud-sun",
    );
    expect(weatherConditionIcon({ text: "阴", icon: "wmo-3" })).toBe("cloudy");
    expect(weatherConditionIcon({ text: "雾", icon: "wmo-45" })).toBe(
      "cloud-fog",
    );
    expect(weatherConditionIcon({ text: "毛毛雨", icon: "wmo-55" })).toBe(
      "cloud-drizzle",
    );
    expect(weatherConditionIcon({ text: "大雨", icon: "wmo-65" })).toBe(
      "cloud-rain",
    );
    expect(weatherConditionIcon({ text: "雪", icon: "wmo-73" })).toBe(
      "cloud-snow",
    );
    expect(weatherConditionIcon({ text: "雷雨", icon: "wmo-95" })).toBe(
      "cloud-lightning",
    );
  });

  it("falls back to Chinese condition text when the icon code is unknown", () => {
    expect(weatherConditionIcon({ text: "晴", icon: "unknown" })).toBe("sun");
    expect(weatherConditionIcon({ text: "多云", icon: "unknown" })).toBe(
      "cloud-sun",
    );
    expect(weatherConditionIcon({ text: "阴", icon: "unknown" })).toBe(
      "cloudy",
    );
    expect(weatherConditionIcon({ text: "暴雨", icon: "unknown" })).toBe(
      "cloud-rain",
    );
    expect(weatherConditionIcon({ text: "雷阵雨", icon: "unknown" })).toBe(
      "cloud-lightning",
    );
    expect(weatherConditionIcon({ text: "雾", icon: "unknown" })).toBe(
      "cloud-fog",
    );
    expect(weatherConditionIcon({ text: "中雪", icon: "unknown" })).toBe(
      "cloud-snow",
    );
    expect(weatherConditionIcon({ text: "冰雹", icon: "unknown" })).toBe(
      "cloud-hail",
    );
  });

  it("defaults to a generic cloud icon", () => {
    expect(weatherConditionIcon({ text: "未知", icon: "unknown" })).toBe(
      "cloud",
    );
    expect(weatherConditionIcon({ text: "未知", icon: "wmo-999" })).toBe(
      "cloud",
    );
  });
});

describe("temperatureRangePositions", () => {
  it("positions each day within the overall range", () => {
    const result = temperatureRangePositions([
      { low: 20, high: 30 },
      { low: 22, high: 28 },
    ]);
    expect(result).toEqual([
      { left: 0, width: 100 },
      { left: 20, width: 60 },
    ]);
  });

  it("handles a flat range without dividing by zero", () => {
    const result = temperatureRangePositions([{ low: 25, high: 25 }]);
    expect(result).toEqual([{ left: 0, width: 100 }]);
  });

  it("handles an empty list", () => {
    expect(temperatureRangePositions([])).toEqual([]);
  });
});
