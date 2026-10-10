import { authPostRoute } from "@/lib/api/routes/auth";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

const origin = "http://localhost:3000";

it("demo.planned-only (REST)", { tags: ["@Account/REST"] }, async ({
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const response = await protocolRuntime.request(() =>
      authPostRoute(
        new Request(`${origin}/api/auth/demo`, {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify({}),
        }),
      ),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
    await response.text();
  });
});
