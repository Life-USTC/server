import { describe, expect, it } from "vitest";
import { extractApiErrorMessage, readApiErrorMessage } from "@/lib/api/client";

describe("api client helpers", () => {
  it("extracts plain and Error messages", () => {
    expect(extractApiErrorMessage("  failed  ")).toBe("failed");
    expect(extractApiErrorMessage(new Error("  failed  "))).toBe("failed");
  });

  it("uses the first non-empty direct error string", () => {
    expect(
      extractApiErrorMessage({
        error: "",
        message: "  validation failed  ",
        detail: "ignored",
      }),
    ).toBe("validation failed");
  });

  it("preserves whitespace-only field fallback behavior", () => {
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

  it("falls back to nested and array error messages", () => {
    expect(
      extractApiErrorMessage({ error: { detail: "  nested failure  " } }),
    ).toBe("nested failure");
    expect(
      extractApiErrorMessage({
        errors: [{ error: "  first item failure  " }],
      }),
    ).toBe("first item failure");
  });

  it("returns null when no usable message is present", () => {
    expect(extractApiErrorMessage(undefined)).toBeNull();
    expect(extractApiErrorMessage({ error: "   ", errors: [] })).toBeNull();
  });

  it("reads API error messages from response bodies", async () => {
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

  it("falls back when response bodies are not JSON error payloads", async () => {
    await expect(
      readApiErrorMessage(
        new Response("plain text failure", { status: 500 }),
        "fallback",
      ),
    ).resolves.toBe("fallback");
  });
});
