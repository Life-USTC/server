import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { getWeatherSnapshotMock } = vi.hoisted(() => ({
  getWeatherSnapshotMock: vi.fn(),
}));

vi.mock("@/features/weather/server/weather-service", () => ({
  getWeatherSnapshot: getWeatherSnapshotMock,
}));

describe("weather REST route", () => {
  let getWeatherRoute: typeof import("@/lib/api/routes/weather").getWeatherRoute;

  beforeAll(async () => {
    ({ getWeatherRoute } = await import("@/lib/api/routes/weather"));
  });

  afterEach(() => {
    getWeatherSnapshotMock.mockReset();
  });

  it("returns 400 for an unknown locationKey", async () => {
    const response = await getWeatherRoute(
      new Request(
        "https://life.example/api/catalog/weather?locationKey=unknown",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid weather query",
    });
    expect(getWeatherSnapshotMock).not.toHaveBeenCalled();
  });

  it("returns 503 when every provider is unavailable", async () => {
    getWeatherSnapshotMock.mockResolvedValue(null);

    const response = await getWeatherRoute(
      new Request(
        "https://life.example/api/catalog/weather?locationKey=ustc-main",
      ),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Weather data is unavailable",
    });
  });
});
