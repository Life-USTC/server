import { describe, expect, it } from "vitest";
import {
  buildAdminUsersWhere,
  toAdminUserListItem,
} from "@/features/admin/server/admin-user-read-model";

describe("admin user read model", () => {
  it("builds one shared search filter for id, name, username, and email", () => {
    expect(buildAdminUsersWhere("  alice  ")).toEqual({
      OR: [
        { id: { contains: "alice", mode: "insensitive" } },
        { name: { contains: "alice", mode: "insensitive" } },
        { username: { contains: "alice", mode: "insensitive" } },
        {
          verifiedEmails: {
            some: { email: { contains: "alice", mode: "insensitive" } },
          },
        },
      ],
    });
  });

  it("keeps suspension data out of API rows unless selected", () => {
    const baseUser = {
      id: "user-1",
      name: "Alice",
      username: "alice",
      isAdmin: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      verifiedEmails: [{ email: "alice@example.com" }],
    };

    expect(toAdminUserListItem(baseUser)).toEqual({
      id: "user-1",
      name: "Alice",
      username: "alice",
      isAdmin: false,
      email: "alice@example.com",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(
      toAdminUserListItem({
        ...baseUser,
        suspensions: [
          {
            id: "suspension-1",
            reason: "policy",
            expiresAt: new Date("2026-02-01T00:00:00.000Z"),
          },
        ],
      }),
    ).toEqual({
      id: "user-1",
      name: "Alice",
      username: "alice",
      isAdmin: false,
      email: "alice@example.com",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      activeSuspension: {
        id: "suspension-1",
        reason: "policy",
        expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    });
  });
});
