import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDemoSessionAuditId,
  isDemoModeEnabled,
  mintDemoApiToken,
  mintDemoWebSession,
  verifyDemoApiToken,
  verifyDemoWebSession,
} from "@/features/demo/server/demo-auth";

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
});
