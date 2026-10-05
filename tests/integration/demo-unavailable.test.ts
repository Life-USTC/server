import { readFile } from "node:fs/promises";
import { authPostRoute } from "@/lib/api/routes/auth";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { graphqlSchemaSdl } from "@/lib/graphql/resources";
import { mcpProtocolTest as it } from "../shared/mcp-protocol-fixture";

const origin = "http://localhost:3000";

// Better Auth owns a module singleton; this file has one native case.
it("demo.planned-only", { tags: ["@Account/OAuth"] }, async ({
  protocolRuntime,
  mcpSessions,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    // Inspect executable registrations, not feature specifications.
    const auth = getBetterAuthInstance();
    expect(Object.keys(auth.api).filter((name) => /demo/i.test(name))).toEqual(
      [],
    );
    const openapi = JSON.parse(
      await readFile(
        new URL("../../public/openapi.generated.json", import.meta.url),
        "utf8",
      ),
    ) as { paths: Record<string, unknown> };
    expect(
      Object.keys(openapi.paths).filter((path) => /demo/i.test(path)),
    ).toEqual([]);
    expect(graphqlSchemaSdl).not.toMatch(/\bdemo\w*/i);

    const client = await mcpSessions.createAnonymousMcpHarness();
    const { tools } = await protocolRuntime.request(() => client.listTools());
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.filter((tool) => /demo/i.test(tool.name))).toEqual([]);
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
