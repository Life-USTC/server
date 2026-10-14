import { describe, expect, it } from "vitest";
import {
  createLocalAccountIssuer,
  createOAuthAccountIssuer,
  GOOGLE_ACCOUNT_ISSUER,
} from "@/lib/auth/account-issuer";

// Better Auth 1.7.7 dropped these helpers, so the encoding now lives here.
// Existing Account.issuer rows were written by 1.7.2, and the SQL guard in
// remove_sign_in_method compares against them, so the strings must not drift.
describe("account issuer encoding", () => {
  it("reproduces the issuers Better Auth 1.7.2 wrote", () => {
    expect(createLocalAccountIssuer("credential")).toBe("local:credential");
    expect(createOAuthAccountIssuer("github")).toBe("local:oauth:github");
    expect(GOOGLE_ACCOUNT_ISSUER).toBe("https://accounts.google.com");
  });

  it("keeps OAuth identities in their own namespace", () => {
    expect(createOAuthAccountIssuer("credential")).not.toBe(
      createLocalAccountIssuer("credential"),
    );
  });

  it("percent-encodes provider ids so separators cannot be forged", () => {
    expect(createLocalAccountIssuer("a:b")).toBe("local:a%3Ab");
    expect(createOAuthAccountIssuer("a/b")).toBe("local:oauth:a%2Fb");
  });
});
