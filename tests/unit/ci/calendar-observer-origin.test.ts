import type { APIRequestContext } from "@playwright/test";
import { request as nativeRequest } from "@playwright/test";
import { afterEach, expect, it, vi } from "vitest";
import { withCalendarObserver } from "../../e2e/utils/calendar-effects";

afterEach(() => vi.restoreAllMocks());

it.each([
  "https://localhost:8443",
  "https://example.test",
  "http://example.test:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
])("retains the original endpoint and TLS authority for %s", async (origin) => {
  const dispose = vi.fn().mockResolvedValue(undefined);
  const create = vi
    .spyOn(nativeRequest, "newContext")
    .mockResolvedValue({ dispose } as unknown as APIRequestContext);
  await withCalendarObserver(origin, async () => {});
  expect(create).toHaveBeenCalledExactlyOnceWith({ baseURL: origin });
  expect(dispose).toHaveBeenCalledTimes(1);
});

it("preserves observation and disposal errors after a local probe failure", async () => {
  const observation = new Error("probe failed");
  const disposal = new Error("disposal failed");
  const dispose = vi.fn().mockRejectedValue(disposal);
  const create = vi
    .spyOn(nativeRequest, "newContext")
    .mockResolvedValue({ dispose } as unknown as APIRequestContext);
  await expect(
    withCalendarObserver("http://localhost:8080", async () => {
      throw observation;
    }),
  ).rejects.toMatchObject({ errors: [observation, disposal] });
  expect(create).toHaveBeenCalledExactlyOnceWith({
    baseURL: "http://127.0.0.1:8080",
    extraHTTPHeaders: { host: "localhost:8080" },
  });
  expect(dispose).toHaveBeenCalledTimes(1);
});
