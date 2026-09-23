import { beforeEach, describe, expect, it, vi } from "vitest";

const { logAppEventMock } = vi.hoisted(() => ({
  logAppEventMock: vi.fn(),
}));

vi.mock("@/lib/log/app-logger", () => ({
  logAppEvent: logAppEventMock,
}));

import { logAdminSecurityEvent } from "@/lib/audit/security-events";

describe("admin security events", () => {
  beforeEach(() => {
    logAppEventMock.mockReset();
  });

  it("uses a fixed route class and excludes request secrets and metadata", () => {
    const request = new Request(
      "https://example.test/api/admin/users/user@example.com?token=secret-token",
      {
        headers: {
          cookie: "better-auth.session_token=secret-cookie",
          "cf-connecting-ip": "192.0.2.5",
          "user-agent": "private-user-agent",
        },
        method: "POST",
      },
    );

    logAdminSecurityEvent(request, "not_admin");

    expect(logAppEventMock).toHaveBeenCalledWith(
      "warn",
      "admin.authorization.denied",
      {
        event: "admin.authorization.denied",
        method: "POST",
        phase: "authorization",
        reason: "not_admin",
        requestId: expect.any(String),
        route: "api_admin",
        source: "security",
      },
    );
    const serialized = JSON.stringify(logAppEventMock.mock.calls);
    expect(serialized).not.toContain("secret-cookie");
    expect(serialized).not.toContain("192.0.2.5");
    expect(serialized).not.toContain("private-user-agent");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("user@example.com");
  });
});
