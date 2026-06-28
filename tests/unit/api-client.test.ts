import { describe, expect, it } from "vitest";
import { extractApiErrorMessage, readApiErrorMessage } from "@/lib/api/client";

describe("api 客户端辅助函数", () => {
  it("提取普通字符串与 Error 消息", () => {
    expect(extractApiErrorMessage("  failed  ")).toBe("failed");
    expect(extractApiErrorMessage(new Error("  failed  "))).toBe("failed");
  });

  it("使用第一个非空的直接错误字符串", () => {
    expect(
      extractApiErrorMessage({
        error: "",
        message: "  validation failed  ",
        detail: "ignored",
      }),
    ).toBe("validation failed");
  });

  it("保留仅空白字段的回退行为", () => {
    expect(
      extractApiErrorMessage({
        error: "   ",
        message: "ignored",
      }),
    ).toBeNull();
    expect(
      extractApiErrorMessage({
        error: { message: "   ", detail: "ignored" },
      }),
    ).toBeNull();
    expect(
      extractApiErrorMessage({
        errors: [{ message: "   ", error: "ignored" }],
      }),
    ).toBeNull();
  });

  it("回退到嵌套与数组错误消息", () => {
    expect(
      extractApiErrorMessage({ error: { detail: "  nested failure  " } }),
    ).toBe("nested failure");
    expect(
      extractApiErrorMessage({
        errors: [{ error: "  first item failure  " }],
      }),
    ).toBe("first item failure");
  });

  it("没有可用消息时返回 null", () => {
    expect(extractApiErrorMessage(undefined)).toBeNull();
    expect(extractApiErrorMessage({ error: "   ", errors: [] })).toBeNull();
  });

  it("从响应体读取 API 错误消息", async () => {
    await expect(
      readApiErrorMessage(
        new Response(JSON.stringify({ error: "  server failed  " }), {
          headers: { "content-type": "application/json" },
          status: 400,
        }),
        "fallback",
      ),
    ).resolves.toBe("server failed");
  });

  it("响应体不是 JSON 错误载荷时回退", async () => {
    await expect(
      readApiErrorMessage(
        new Response("plain text failure", { status: 500 }),
        "fallback",
      ),
    ).resolves.toBe("fallback");
  });
});
