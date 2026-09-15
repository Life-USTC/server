import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPasskeySupported,
  passkeyClientErrorKind,
} from "@/lib/auth/passkey-client";

describe("passkey client helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["SESSION_NOT_FRESH", "stale-session"],
    ["ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED", "duplicate"],
    ["PREVIOUSLY_REGISTERED", "duplicate"],
    ["AUTH_CANCELLED", "cancelled"],
    ["REGISTRATION_CANCELLED", "cancelled"],
    ["ERROR_CEREMONY_ABORTED", "cancelled"],
    ["ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", "cancelled"],
    ["ERROR_INVALID_RP_ID", "generic"],
    ["AUTHENTICATION_FAILED", "generic"],
    [undefined, "generic"],
  ])("maps %s to %s", (code, expected) => {
    expect(passkeyClientErrorKind(code ? { code } : null)).toBe(expected);
  });

  it("reports WebAuthn unavailable outside a browser", () => {
    expect(isPasskeySupported()).toBe(false);
  });

  it("requires both credential ceremony methods", () => {
    vi.stubGlobal("window", { PublicKeyCredential: class {} });
    vi.stubGlobal("navigator", {
      credentials: {
        create: vi.fn(),
        get: vi.fn(),
      },
    });

    expect(isPasskeySupported()).toBe(true);
  });
});
