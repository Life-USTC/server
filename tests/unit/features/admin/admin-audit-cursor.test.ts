import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/auth-prisma", () => ({ authPrisma: {} }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));

import {
  adminAuditCursorWhere,
  decodeAdminAuditCursor,
  encodeAdminAuditCursor,
  safeAdminAuditTargetId,
} from "@/features/admin/server/admin-audit-page-data";

describe("admin audit keyset cursor", () => {
  it("round-trips a stable createdAt/id cursor and rejects tampering", () => {
    const cursor = {
      createdAt: new Date("2026-08-15T10:20:30.123Z"),
      id: "audit-row-2",
    };
    const encoded = encodeAdminAuditCursor(cursor);

    expect(decodeAdminAuditCursor(encoded)).toEqual(cursor);
    const changed = `${encoded.slice(0, 10)}${encoded[10] === "A" ? "B" : "A"}${encoded.slice(11)}`;
    expect(decodeAdminAuditCursor(changed)).toBeNull();
    expect(decodeAdminAuditCursor(`${encoded}*`)).toBeNull();
  });

  it("uses id as the deterministic tie-breaker for equal timestamps", () => {
    const createdAt = new Date("2026-08-15T10:20:30.123Z");
    expect(adminAuditCursorWhere({ createdAt, id: "audit-row-2" })).toEqual({
      OR: [
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: "audit-row-2" } },
      ],
    });
  });

  it("does not project authentication credential identifiers", () => {
    expect(safeAdminAuditTargetId("session", "raw-session-id")).toBeNull();
    expect(safeAdminAuditTargetId("passkey", "raw-passkey-id")).toBeNull();
    expect(safeAdminAuditTargetId("account", "raw-account-id")).toBeNull();
    expect(
      safeAdminAuditTargetId("oauth_consent", "raw-consent-id"),
    ).toBeNull();
    expect(safeAdminAuditTargetId("homework", "homework-id")).toBe(
      "homework-id",
    );
  });
});
