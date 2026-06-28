import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBusDataUrl,
  loadBusStaticPayload,
} from "@/features/bus/lib/bus-static-source";

describe("班车静态数据源", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("使用已发布的静态班车数据 URL", () => {
    expect(getBusDataUrl()).toBe(
      "https://static.life-ustc.tiankaima.dev/bus_data_v3.json",
    );
  });

  it("从已发布的静态主机加载数据载荷", async () => {
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

  it("已发布数据载荷无法加载时抛出异常", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 })),
    );
    await expect(loadBusStaticPayload()).rejects.toThrow(
      /Static asset request failed: 404/,
    );
  });
});
