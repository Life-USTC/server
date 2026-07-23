import { describe, expect, it, vi } from "vitest";
import {
  runCloudflareTraceSpan,
  runWithCloudflareRuntimeEnv,
} from "@/lib/adapters/cloudflare-runtime";

describe("Cloudflare runtime tracing", () => {
  it("creates a custom span and attaches bounded semantic attributes", async () => {
    const setAttribute = vi.fn();
    const enterSpan = vi.fn(
      <T>(
        _name: string,
        callback: (span: { setAttribute: typeof setAttribute }) => T,
      ) => callback({ setAttribute }),
    );

    const result = await runWithCloudflareRuntimeEnv(
      {},
      () =>
        runCloudflareTraceSpan(
          "mcp.authenticate",
          {
            "http.request.method": "POST",
            "mcp.rpc_count": 1,
            omitted: undefined,
          },
          () => "ok",
        ),
      { tracing: { enterSpan } },
    );

    expect(result).toBe("ok");
    expect(enterSpan).toHaveBeenCalledWith(
      "mcp.authenticate",
      expect.any(Function),
    );
    expect(setAttribute).toHaveBeenCalledWith("http.request.method", "POST");
    expect(setAttribute).toHaveBeenCalledWith("mcp.rpc_count", 1);
    expect(setAttribute).not.toHaveBeenCalledWith("omitted", undefined);
  });

  it("runs callbacks unchanged outside the Workers runtime", () => {
    expect(runCloudflareTraceSpan("app.test", {}, () => 42)).toBe(42);
  });
});
