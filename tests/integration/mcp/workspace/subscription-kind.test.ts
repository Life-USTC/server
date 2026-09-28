import { describe } from "vitest";
import { actorFixture, DEV_SEED } from "../_harness";
import { mcpTest } from "../_harness/context";

const toolTest = mcpTest
  .extend(
    "owner",
    actorFixture({
      emailPrefix: "kind-owner",
      name: "Kind owner",
    }),
  )
  .extend(
    "other",
    actorFixture({
      emailPrefix: "kind-other",
      name: "Other owner",
    }),
  );

describe("subscription kind transport", () => {
  toolTest(
    "mcp.subscription-kind-projection",
    async ({ owner, other, expect }) => {
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
        expect(
          list.sections.find((section) => section.jwId === jwId)?.kind,
        ).toBe("auditor");
      }
    },
  );
});
