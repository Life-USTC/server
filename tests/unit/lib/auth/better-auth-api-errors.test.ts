import { beforeEach, describe, expect, it, vi } from "vitest";

const { isOAuthDebugLoggingMock, logOAuthDebugMock } = vi.hoisted(() => ({
  isOAuthDebugLoggingMock: vi.fn(),
  logOAuthDebugMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth-config", () => ({
  isDevelopment: () => false,
}));

vi.mock("@/lib/log/oauth-debug", async (importOriginal) => ({
  ...(await importOriginal()),
  isOAuthDebugLogging: isOAuthDebugLoggingMock,
  logOAuthDebug: logOAuthDebugMock,
}));

import { betterAuthApiErrorHandler } from "@/lib/auth/better-auth-api-errors";

describe("better-auth OAuth API error event keys", () => {
  beforeEach(() => {
    isOAuthDebugLoggingMock.mockReset().mockReturnValue(true);
    logOAuthDebugMock.mockReset();
  });

  it.each([
    [{ code: "state_mismatch" }, "oauth.callback.state_mismatch"],
    [{ code: "state_not_found" }, "oauth.callback.state_mismatch"],
    [{ code: "invalid_grant" }, "oauth.token.invalid_grant"],
    [{ code: "invalid_request" }, "oauth.token.invalid_request"],
    [{ error: "invalid_grant" }, "oauth.token.invalid_grant"],
  ] as const)("maps %j to stable event %s", (error, event) => {
    betterAuthApiErrorHandler.onError(error);

    expect(logOAuthDebugMock).toHaveBeenCalledWith(
      event,
      undefined,
      expect.objectContaining({ errorName: expect.any(String) }),
    );
  });
});
