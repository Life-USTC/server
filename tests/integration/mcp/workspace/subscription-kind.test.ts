import { describe, expect, it } from "vitest";
import { createIsolatedMcpToolTestContext, DEV_SEED } from "../_harness";

const owner = createIsolatedMcpToolTestContext({
  emailPrefix: "kind-owner",
  name: "Kind owner",
});
const other = createIsolatedMcpToolTestContext({
  emailPrefix: "kind-other",
  name: "Other owner",
});

describe("subscription kind transport", () => {
  it("edits existing memberships and returns kind in both list modes", async () => {
    const jwId = DEV_SEED.section.jwId;
    await owner.client.call("workspace_subscription_add", { jwId });
    expect(
      await owner.client.call("workspace_subscription_kind_update", {
        jwId,
        kind: "auditor",
      }),
    ).toMatchObject({ success: true, sectionJwId: jwId, kind: "auditor" });
    expect(
      await other.client.call("workspace_subscription_kind_update", {
        jwId,
        kind: "teaching_assistant",
      }),
    ).toMatchObject({ success: false });
    await owner.client.call("workspace_subscription_add", { jwId });
    const graphql = await owner.client.call<{
      success: boolean;
      data: { subscriptionKindUpdate: { kind: string } };
    }>("graphql_operation_run", {
      operationId: "workspace.subscription.kind.update.v1",
      variables: { jwId, kind: "auditor" },
      confirmed: true,
    });
    expect(graphql.success).toBe(true);
    expect(graphql.data.subscriptionKindUpdate.kind).toBe("auditor");
    const memberships = await owner.client.call<{
      data: {
        workspace: {
          subscribedSections: {
            items: Array<{ kind: string; section: { jwId: number } }>;
          };
        };
      };
    }>("graphql_operation_run", {
      operationId: "workspace.subscription.list.v1",
      variables: { page: { pageSize: 10 } },
    });
    expect(memberships.data.workspace.subscribedSections.items).toMatchObject([
      { kind: "auditor", section: { jwId } },
    ]);

    for (const mode of ["default", "full"]) {
      const list = await owner.client.call<{
        sections: Array<{ jwId: number; kind: string }>;
      }>("workspace_subscription_list", { mode });
      expect(list.sections.find((section) => section.jwId === jwId)?.kind).toBe(
        "auditor",
      );
    }
  });
});
