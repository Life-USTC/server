import { isHttpError } from "@sveltejs/kit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "@/routes/e2e/+layout.server";

type LoadEvent = Parameters<typeof load>[0];

function runLoad() {
  try {
    load({} as LoadEvent);
    return null;
  } catch (error) {
    return error;
  }
}

describe("/e2e 测试回调路由", () => {
  beforeEach(() => {
    vi.stubEnv("E2E_DEBUG_AUTH", undefined);
  });

  it("生产环境返回 404", () => {
    vi.stubEnv("NODE_ENV", "production");

    const error = runLoad();
    expect(isHttpError(error, 404)).toBe(true);
  });

  it("未开启 E2E 调试认证的测试运行时返回 404", () => {
    vi.stubEnv("NODE_ENV", "test");

    const error = runLoad();
    expect(isHttpError(error, 404)).toBe(true);
  });

  it("Playwright Worker 与本地开发保持可用", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_DEBUG_AUTH", "1");
    expect(runLoad()).toBeNull();

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("E2E_DEBUG_AUTH", undefined);
    expect(runLoad()).toBeNull();
  });
});
