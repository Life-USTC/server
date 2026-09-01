import { beforeEach, describe, expect, it, vi } from "vitest";
import { runWeatherCronSnapshot } from "../../src/features/weather/server/weather-cron";

const { refreshWeatherSnapshotMock } = vi.hoisted(() => ({
  refreshWeatherSnapshotMock: vi.fn(),
}));

vi.mock("../../src/features/weather/server/weather-service", () => ({
  refreshWeatherSnapshot: refreshWeatherSnapshotMock,
}));

describe("runWeatherCronSnapshot", () => {
  beforeEach(() => {
    refreshWeatherSnapshotMock.mockReset();
  });

  it("forwards the location key and reports refreshed when a snapshot exists", async () => {
    refreshWeatherSnapshotMock.mockResolvedValue({ locationKey: "ustc-main" });

    const result = await runWeatherCronSnapshot("ustc-main");

    expect(refreshWeatherSnapshotMock).toHaveBeenCalledWith("ustc-main");
    expect(result).toEqual({ locationKey: "ustc-main", refreshed: true });
  });

  it("reports refreshed false when no snapshot is available", async () => {
    refreshWeatherSnapshotMock.mockResolvedValue(null);

    const result = await runWeatherCronSnapshot("ustc-gaoxin");

    expect(refreshWeatherSnapshotMock).toHaveBeenCalledWith("ustc-gaoxin");
    expect(result).toEqual({ locationKey: "ustc-gaoxin", refreshed: false });
  });
});
