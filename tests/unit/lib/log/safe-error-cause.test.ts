import { describe, expect, it, vi } from "vitest";
import { getSafeErrorCauseDetails } from "@/lib/log/safe-error-cause";

describe("content-free error cause hints", () => {
  it("keeps fixed transport codes at the root or nested under causes", () => {
    for (const code of [
      "ECONNREFUSED",
      "ETIMEDOUT",
      "UND_ERR_CONNECT_TIMEOUT",
    ]) {
      expect(getSafeErrorCauseDetails({ code })).toEqual({
        transportCode: code,
      });
      expect(
        getSafeErrorCauseDetails(new Error("secret", { cause: { code } })),
      ).toEqual({ transportCode: code });
    }
  });

  it("does not use constructor names, messages, stack, or arbitrary codes", () => {
    class SecretTokenABC extends Error {}
    expect(
      getSafeErrorCauseDetails(
        new Error("ETIMEDOUT", {
          cause: Object.assign(new SecretTokenABC("private"), {
            code: "ECONNRESET private",
            stack: "secret",
            sql: "private SQL",
          }),
        }),
      ),
    ).toEqual({});
  });

  it("does not invoke accessors when reading a cause", () => {
    const getter = vi.fn(() => {
      throw new Error("secret");
    });
    const cause = Object.defineProperties(
      {},
      {
        code: { get: getter },
        cause: { get: getter },
        name: { get: getter },
        errors: { get: getter },
      },
    );
    expect(getSafeErrorCauseDetails(new Error("outer", { cause }))).toEqual({});
    expect(getter).not.toHaveBeenCalled();
  });

  it("stops cycles and does not traverse arbitrary metadata", () => {
    const error: Record<string, unknown> = { meta: { code: "ECONNRESET" } };
    error.cause = error;
    error.errors = [error];
    expect(getSafeErrorCauseDetails(error)).toEqual({});
  });

  it("bounds cause depth and aggregate entries", () => {
    let deep: unknown = { code: "ECONNRESET" };
    for (let index = 0; index < 6; index++) deep = { cause: deep };
    expect(getSafeErrorCauseDetails(deep)).toEqual({});
    expect(
      getSafeErrorCauseDetails(
        new AggregateError([
          ...Array.from({ length: 8 }, () => new Error("private")),
          { code: "ECONNRESET" },
        ]),
      ),
    ).toEqual({});
  });

  it("keeps deterministic first diagnostic hints across an aggregate", () => {
    expect(
      getSafeErrorCauseDetails(
        new AggregateError([
          new TypeError("secret"),
          { name: "error", code: "ECONNRESET" },
          { code: "ETIMEDOUT" },
        ]),
      ),
    ).toEqual({ causeName: "TypeError", transportCode: "ECONNRESET" });
  });

  it("ignores revoked proxies without interrupting logging", () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    expect(
      getSafeErrorCauseDetails(new Error("secret", { cause: proxy })),
    ).toEqual({});
  });
});
