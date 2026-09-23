import { beforeEach, expect, it, vi } from "vitest";

const { getWeatherSnapshot } = vi.hoisted(() => ({
  getWeatherSnapshot: vi.fn(),
}));
vi.mock("@/features/weather/server/weather-service", () => ({
  getWeatherSnapshot,
}));

import { getWeatherRoute } from "@/lib/api/routes/weather";

beforeEach(() => getWeatherSnapshot.mockReset());

it("reports provider unavailability as a service failure for a valid location", async () => {
  getWeatherSnapshot.mockResolvedValue(null);
  const response = await getWeatherRoute(
    new Request(
      "https://example.com/api/catalog/weather?locationKey=ustc-main",
    ),
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: "Weather data is unavailable",
  });
  expect(getWeatherSnapshot).toHaveBeenCalledExactlyOnceWith("ustc-main");
});

it("rejects invalid locations before attempting a provider lookup", async () => {
  const response = await getWeatherRoute(
    new Request("https://example.com/api/catalog/weather?locationKey=invalid"),
  );
  expect(response.status).toBe(400);
  expect(getWeatherSnapshot).not.toHaveBeenCalled();
});
