import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requireDemoApiScope } from "@/features/demo/server/demo-api-auth";
import {
  getDemoSessionAuditId,
  isDemoModeEnabled,
  mintDemoApiToken,
  mintDemoWebSession,
  verifyDemoApiToken,
  verifyDemoWebSession,
} from "@/features/demo/server/demo-auth";
import { simulateDemoTodoCreate } from "@/features/demo/server/demo-fixtures";

const previousEnv = { ...process.env };

describe("demo authentication realm", () => {
  beforeEach(() => {
    process.env.DEMO_MODE_ENABLED = "true";
    process.env.DEMO_SIGNING_SECRET =
      "demo-test-secret-that-is-at-least-32-bytes";
  });

  afterEach(() => {
    process.env = { ...previousEnv };
  });

  it("is disabled unless explicitly enabled", () => {
    expect(isDemoModeEnabled({})).toBe(false);
    expect(isDemoModeEnabled({ DEMO_MODE_ENABLED: "true" })).toBe(true);
  });

  it("keeps web sessions and API tokens in separate audiences", async () => {
    const web = await mintDemoWebSession("session-1");
    const api = await mintDemoApiToken("session-1");

    await expect(verifyDemoWebSession(web)).resolves.toMatchObject({
      kind: "demo",
      sessionId: "session-1",
    });
    await expect(verifyDemoApiToken(api)).resolves.toMatchObject({
      kind: "demo",
      sessionId: "session-1",
    });
    await expect(verifyDemoApiToken(web)).resolves.toBeNull();
    await expect(verifyDemoWebSession(api)).resolves.toBeNull();
  });

  it("rejects every token when the kill switch is off", async () => {
    const token = await mintDemoApiToken("session-1");
    process.env.DEMO_MODE_ENABLED = "false";
    await expect(verifyDemoApiToken(token)).resolves.toBeNull();
  });

  it("uses a stable opaque audit identifier instead of the session ID", () => {
    const auditId = getDemoSessionAuditId("session-1");
    expect(auditId).toHaveLength(24);
    expect(auditId).not.toContain("session-1");
    expect(getDemoSessionAuditId("session-1")).toBe(auditId);
  });

  it("hides demo API routes when the kill switch is off", async () => {
    process.env.DEMO_MODE_ENABLED = "false";
    const response = await requireDemoApiScope(
      new Request("https://example.test/api/demo/todos"),
      "demo:todo:read",
    );
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(404);
    await expect((response as Response).json()).resolves.toEqual({
      error: "Not found",
    });
  });

  it("does not derive simulated resource IDs from session IDs", () => {
    const result = simulateDemoTodoCreate(
      {
        kind: "demo",
        sessionId: "sensitive-session-prefix",
        fixtureVersion: "2026-07-22",
        scopes: new Set(),
      },
      "Simulated",
    );
    expect(result.todo.id).not.toContain("sensitive");
  });
});
