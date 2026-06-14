import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBusDataUrl,
  loadBusStaticPayload,
} from "@/features/bus/lib/bus-static-source";

describe("bus static source", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the published static bus data URL", () => {
    expect(getBusDataUrl()).toBe(
      "https://static.life-ustc.tiankaima.dev/bus_data_v3.json",
    );
  });

  it("loads the payload from the published static host", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ versionKey: "2026.04" }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const payload = await loadBusStaticPayload();
    expect(payload).toMatchObject({ versionKey: "2026.04" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://static.life-ustc.tiankaima.dev/bus_data_v3.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("throws when the published payload cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 })),
    );
    await expect(loadBusStaticPayload()).rejects.toThrow(
      /Static asset request failed: 404/,
    );
  });
});
