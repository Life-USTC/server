import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWeatherCronSnapshot } from "../../src/features/weather/server/weather-cron";

const { getWeatherSnapshotMock } = vi.hoisted(() => ({
  getWeatherSnapshotMock: vi.fn(),
}));

vi.mock("../../src/features/weather/server/weather-service", () => ({
  getWeatherSnapshot: getWeatherSnapshotMock,
}));

describe("runWeatherCronSnapshot", () => {
  beforeEach(() => {
    getWeatherSnapshotMock.mockReset();
  });

  it("forwards the location key and reports refreshed when a snapshot exists", async () => {
    getWeatherSnapshotMock.mockResolvedValue({ locationKey: "ustc-main" });

    const result = await runWeatherCronSnapshot("ustc-main");

    expect(getWeatherSnapshotMock).toHaveBeenCalledWith("ustc-main");
    expect(result).toEqual({ locationKey: "ustc-main", refreshed: true });
  });

  it("reports refreshed false when no snapshot is available", async () => {
    getWeatherSnapshotMock.mockResolvedValue(null);

    const result = await runWeatherCronSnapshot("ustc-gaoxin");

    expect(getWeatherSnapshotMock).toHaveBeenCalledWith("ustc-gaoxin");
    expect(result).toEqual({ locationKey: "ustc-gaoxin", refreshed: false });
  });
});
