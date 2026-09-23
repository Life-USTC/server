import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchLifeUstcStaticJson,
  fetchRequiredLifeUstcStaticJson,
  getLifeUstcStaticUrl,
  LIFE_USTC_STATIC_ORIGIN,
} from "@/lib/static-assets";

describe("静态资源辅助函数", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("从已发布静态源构建 URL", () => {
    expect(LIFE_USTC_STATIC_ORIGIN).toBe(
      "https://static.life-ustc.tiankaima.dev",
    );
    expect(getLifeUstcStaticUrl("/geo_data.json")).toBe(
      "https://static.life-ustc.tiankaima.dev/geo_data.json",
    );
  });

  it("可选静态 JSON 失败时返回兜底数据", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 })),
    );

    await expect(
      fetchLifeUstcStaticJson("geo_data.json", { locations: [] }),
    ).resolves.toEqual({ locations: [] });
    expect(warnSpy).toHaveBeenCalled();
  });

  it("必需静态 JSON 失败时抛出异常", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 })),
    );

    await expect(
      fetchRequiredLifeUstcStaticJson("bus_data_v3.json"),
    ).rejects.toThrow(/Static asset request failed: 404/);
  });
});
