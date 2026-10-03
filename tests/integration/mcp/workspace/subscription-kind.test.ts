import { describe } from "vitest";
import { isolatedMcpTest as toolTest } from "../_harness/isolated-context";

describe("subscription kind transport", () => {
  toolTest(
    "mcp.subscription-kind-projection",
    async ({
      mcpWorkflow,
      mcpActor: owner,
      mcpOtherActor: other,
      mcpSection,
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const jwId = mcpSection.jwId;
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
          expect(
            list.sections.find((section) => section.jwId === jwId)?.kind,
          ).toBe("auditor");
        }
      }),
  );
});
