import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildSchema } from "graphql";
import { Project, SyntaxKind } from "ts-morph";
import { expect, it } from "vitest";
import { graphqlTypeDefs } from "@/lib/graphql/schema";
import { createMcpServer } from "@/lib/mcp/server";
import openapi from "../../../../public/openapi.generated.json";

// This checks the complete transport registries, including MCP schema setup.
it("openapi.crawler-ingestion-rest-only", { timeout: 15_000 }, async () => {
  const operations = Object.entries(openapi.paths).flatMap(([path, methods]) =>
    path.startsWith("/api/ingestion/publications/")
      ? Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`)
      : [],
  );
  expect(operations.sort()).toEqual([
    "POST /api/ingestion/publications/batches",
    "POST /api/ingestion/publications/objects/plan",
    "PUT /api/ingestion/publications/objects/{batchId}/{kind}/{sha256}",
  ]);
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths([
    "src/routes/**/*.ts",
    "src/lib/graphql/**/*.ts",
    "src/lib/mcp/**/*.ts",
  ]);
  const callers: string[] = [];
  for (const source of project.getSourceFiles()) {
    const references = source
      .getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((node) => node.getLiteralText());
    if (
      !references.some((value) =>
        /(?:^|\/)publication-(?:ingestion-(?:service|routes)|object-service)$/.test(
          value,
        ),
      )
    )
      continue;
    const path = source.getFilePath().replaceAll("\\", "/");
    expect(
      path,
      "Crawler writes cannot be imported into another transport",
    ).toContain("/src/routes/api/ingestion/publications/");
    expect(path.endsWith("/+server.ts")).toBe(true);
    callers.push(path);
  }
  expect(callers).toHaveLength(3);
  const mutations = Object.keys(
    buildSchema(graphqlTypeDefs).getMutationType()?.getFields() ?? {},
  );
  expect(mutations.length).toBeGreaterThan(20);
  expect(
    mutations.filter((name) => /publication|crawler|ingestion/i.test(name)),
  ).toEqual([]);
  const server = createMcpServer();
  const client = new Client({ name: "ingestion-boundary", version: "1" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(30);
    expect(
      tools.filter((tool) => /publication|crawler|ingestion/i.test(tool.name)),
    ).toEqual([]);
  } finally {
    await client.close();
    await server.close();
  }
});
