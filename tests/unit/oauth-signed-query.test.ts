import { makeSignature } from "better-auth/crypto";
import { describe, expect, it, vi } from "vitest";
import {
  verifySignedOAuthQuery,
  verifySignedOAuthQueryState,
} from "@/features/oauth/server/signed-oauth-query.server";

const SECRET = "signed-oauth-query-test-secret-at-least-32-bytes";

async function sign(params: URLSearchParams) {
  params.set("sig", await makeSignature(params.toString(), SECRET));
  return params.toString();
}

describe("signed OAuth query", () => {
  it("验证签名与期限，并只返回 Provider 已验证的业务字段", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    const query = new URLSearchParams({
      response_type: "code",
      client_id: "client-1",
      exp: "1800000600",
      ba_iat: "1800000000000",
      ba_pl: "session-1",
    });

    const verified = await verifySignedOAuthQuery(await sign(query), SECRET);

    expect(Object.fromEntries(verified?.entries() ?? [])).toEqual({
      response_type: "code",
      client_id: "client-1",
    });
    vi.restoreAllMocks();
  });

  it("保留签名的 prompt 会话元数据供 consent 做当前会话校验", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    const query = new URLSearchParams({
      response_type: "code",
      client_id: "client-1",
      exp: "1800000600",
      ba_iat: "1800000000000",
      ba_pl: "session-1",
    });

    const verified = await verifySignedOAuthQueryState(
      await sign(query),
      SECRET,
    );

    expect(verified).toMatchObject({
      issuedAt: new Date(1_800_000_000_000),
      postLoginClearedForSession: "session-1",
    });
    expect(Object.fromEntries(verified?.query.entries() ?? [])).toEqual({
      response_type: "code",
      client_id: "client-1",
    });
    vi.restoreAllMocks();
  });

  it.each([
    "expired",
    "tampered",
    "duplicate-signature",
  ])("拒绝 %s state", async (kind) => {
    vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    const query = new URLSearchParams({
      response_type: "code",
      client_id: "client-1",
      exp: kind === "expired" ? "1799999999" : "1800000600",
    });
    const signed = new URLSearchParams(await sign(query));
    if (kind === "tampered") signed.set("client_id", "client-2");
    if (kind === "duplicate-signature") signed.append("sig", "duplicate");

    await expect(
      verifySignedOAuthQuery(signed.toString(), SECRET),
    ).resolves.toBeNull();
    vi.restoreAllMocks();
  });
});
