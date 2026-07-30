import { describe, expect, it, vi } from "vitest";
import {
  AUTH_RECORD_CLEANUP_BATCH_SIZE,
  cleanupExpiredAuthRecords,
} from "@/features/auth/server/auth-record-cleanup";

describe("expired auth record cleanup boundary", () => {
  it("calls only the cleanup function and maps its bigint summary", async () => {
    const cutoff = new Date("2026-07-30T00:00:00.000Z");
    const queryRaw = vi.fn().mockResolvedValue([
      {
        sessions: 1n,
        verification_tokens: 2n,
        oauth_access_tokens: 3n,
        oauth_refresh_tokens: 4n,
        device_codes: 5n,
      },
    ]);

    await expect(
      cleanupExpiredAuthRecords({ $queryRaw: queryRaw } as never, cutoff),
    ).resolves.toEqual({
      sessions: 1,
      verificationTokens: 2,
      oauthAccessTokens: 3,
      oauthRefreshTokens: 4,
      deviceCodes: 5,
    });

    expect(queryRaw).toHaveBeenCalledOnce();
    const query = queryRaw.mock.calls[0]?.[0] as {
      sql: string;
      values: unknown[];
    };
    expect(query.sql).toContain("FROM public.cleanup_expired_auth_records(");
    expect(query.sql).not.toContain("DELETE");
    expect(query.values).toEqual([cutoff, AUTH_RECORD_CLEANUP_BATCH_SIZE]);
  });

  it("propagates a database rejection without retrying or falling back", async () => {
    const cutoff = new Date("2999-01-01T00:00:00.000Z");
    const databaseError = new Error("cutoff must not be in the future");
    const queryRaw = vi.fn().mockRejectedValue(databaseError);

    await expect(
      cleanupExpiredAuthRecords({ $queryRaw: queryRaw } as never, cutoff),
    ).rejects.toBe(databaseError);

    expect(queryRaw).toHaveBeenCalledOnce();
    const query = queryRaw.mock.calls[0]?.[0] as {
      sql: string;
      values: unknown[];
    };
    expect(query.values).toEqual([cutoff, AUTH_RECORD_CLEANUP_BATCH_SIZE]);
  });
});
