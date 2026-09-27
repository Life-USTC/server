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
  it("mcp.subscription-kind-projection", async () => {
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
