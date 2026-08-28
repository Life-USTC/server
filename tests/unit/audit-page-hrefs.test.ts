import { describe, expect, it } from "vitest";
import { buildAdminAuditHref } from "../../src/features/admin/lib/audit-page-hrefs";

describe("buildAdminAuditHref", () => {
  it("preserves active filters when returning to the newest records", () => {
    expect(
      buildAdminAuditHref({
        action: "oauth_client_create",
        actor: "user-1",
        outcome: "success",
      }),
    ).toBe(
      "/admin/audit?action=oauth_client_create&actor=user-1&outcome=success",
    );
  });

  it("adds a cursor without dropping filters", () => {
    expect(buildAdminAuditHref({ action: "user_suspend" }, "next-page")).toBe(
      "/admin/audit?action=user_suspend&cursor=next-page",
    );
  });

  it("omits empty query values", () => {
    expect(
      buildAdminAuditHref({ action: "", actor: null, target: undefined }),
    ).toBe("/admin/audit");
  });
});
