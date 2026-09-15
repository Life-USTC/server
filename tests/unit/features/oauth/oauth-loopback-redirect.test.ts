import { describe, expect, it } from "vitest";
import { resolveEquivalentLoopbackRedirectUri } from "@/lib/oauth/loopback-redirect";

describe("OAuth 环回重定向规范化", () => {
  it("localhost 与 127.0.0.1 仅主机不同时返回已注册 URI", () => {
    expect(
      resolveEquivalentLoopbackRedirectUri(
        ["http://127.0.0.1:52877/callback"],
        "http://localhost:52877/callback",
      ),
    ).toBe("http://127.0.0.1:52877/callback");
  });

  it("对路径、端口、查询和片段保持严格匹配", () => {
    expect(
      resolveEquivalentLoopbackRedirectUri(
        ["http://127.0.0.1:52877/callback"],
        "http://localhost:52878/callback",
      ),
    ).toBeNull();
    expect(
      resolveEquivalentLoopbackRedirectUri(
        ["http://127.0.0.1:52877/callback"],
        "http://localhost:52877/other",
      ),
    ).toBeNull();
    expect(
      resolveEquivalentLoopbackRedirectUri(
        ["http://127.0.0.1:52877/callback?code=1#done"],
        "http://localhost:52877/callback?code=2#done",
      ),
    ).toBeNull();
    expect(
      resolveEquivalentLoopbackRedirectUri(
        ["http://127.0.0.1:52877/callback?code=1#done"],
        "http://localhost:52877/callback?code=1#other",
      ),
    ).toBeNull();
  });

  it("不重写非环回 URI", () => {
    expect(
      resolveEquivalentLoopbackRedirectUri(
        ["https://client.example/callback"],
        "https://client.example/callback",
      ),
    ).toBeNull();
  });
});
