import { describe, expect, it } from "vitest";
import {
  buildUserUstcIdentitySummary,
  extractUstcOidcIdentityClaims,
} from "@/features/settings/lib/ustc-identity";

describe("USTC identity helpers", () => {
  it("extracts gid, sno, and publishable email from OIDC profile claims", () => {
    expect(
      extractUstcOidcIdentityClaims(
        {
          sub: "435",
          user_id: 435,
          gid: "gid-abc",
          sno: "BA12345678",
          email: "student@mail.ustc.edu.cn",
          email_verified: true,
          name: "Student",
          picture: "https://example.com/a.png",
        },
        "435",
      ),
    ).toEqual({
      upstreamUid: "435",
      gid: "gid-abc",
      sno: "BA12345678",
      email: "student@mail.ustc.edu.cn",
      emailVerified: true,
      name: "Student",
      picture: "https://example.com/a.png",
    });
  });

  it("ignores passport fake_email placeholders", () => {
    expect(
      extractUstcOidcIdentityClaims(
        {
          sub: "435",
          fake_email: "fakegid+gid-435@example.com",
          fake_email_verified: true,
        },
        "435",
      ),
    ).toEqual({
      upstreamUid: "435",
      gid: null,
      sno: null,
      email: null,
      emailVerified: false,
      name: null,
      picture: null,
    });
  });

  it("returns null gid/sno when claims are missing", () => {
    expect(
      extractUstcOidcIdentityClaims(
        {
          sub: "435",
          user_id: 435,
        },
        "435",
      ),
    ).toEqual({
      upstreamUid: "435",
      gid: null,
      sno: null,
      email: null,
      emailVerified: false,
      name: null,
      picture: null,
    });
  });

  it("builds upstream uid array from all stored identity records", () => {
    const summary = buildUserUstcIdentitySummary([
      {
        upstreamUid: "100",
        gid: "gid-1",
        sno: "BA100",
        firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
        lastSyncedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        upstreamUid: "200",
        gid: "gid-2",
        sno: "BA200",
        firstSeenAt: new Date("2026-01-03T00:00:00.000Z"),
        lastSyncedAt: new Date("2026-01-04T00:00:00.000Z"),
      },
    ]);

    expect(summary.upstreamUids).toEqual(["200", "100"]);
    expect(summary.records).toHaveLength(2);
  });
});
