import { mcpProtocolTest as it } from "../shared/mcp-protocol-fixture";

it("demo.planned-only (MCP)", { tags: ["@Account/MCP"] }, async ({
  protocolRuntime,
  mcpSessions,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const client = await mcpSessions.createAnonymousMcpHarness();
    const { tools } = await protocolRuntime.request(() => client.listTools());
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.filter((tool) => /demo/i.test(tool.name))).toEqual([]);
  });
});
