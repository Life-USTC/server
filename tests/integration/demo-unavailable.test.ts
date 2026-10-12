import { readFile } from "node:fs/promises";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { graphqlSchemaSdl } from "@/lib/graphql/resources";
import { nodeProtocolTest as it } from "../shared/node-protocol-fixture";

it("demo.planned-only (Runtime)", { tags: ["@Account/Runtime"] }, async ({
  protocolRuntime,
  expect,
}) => {
  await protocolRuntime.run(async () => {
    const auth = getBetterAuthInstance();
    // Initialization must settle before this runtime releases its database.
    await auth.$context;
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
  });
});
