import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { graphqlSchemaSdl } from "@/lib/graphql/resources";
import {
  classifyGraphqlDangerousChanges,
  findGraphqlBreakingChanges,
} from "@/lib/graphql/schema-diff";

const snapshotRelativePath = "docs/graphql/schema.graphql";
const snapshotPath = fileURLToPath(
  new URL(`../../${snapshotRelativePath}`, import.meta.url),
);

function readSnapshotAtRef(ref: string) {
  try {
    return execFileSync("git", ["show", `${ref}:${snapshotRelativePath}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (error) {
    throw new Error(
      `Unable to read GraphQL schema snapshot from configured base ref ${ref}`,
      { cause: error },
    );
  }
}

describe("GraphQL schema snapshot", () => {
  it("matches the canonical SDL file", async () => {
    await expect(graphqlSchemaSdl).toMatchFileSnapshot(snapshotPath);
  });

  it("does not break the configured base schema", () => {
    if (process.env.GRAPHQL_SCHEMA_SKIP_BASE_COMPATIBILITY === "true") return;

    const baseRef =
      process.env.GRAPHQL_SCHEMA_BASE_REF ??
      (process.env.GITHUB_BASE_REF
        ? `origin/${process.env.GITHUB_BASE_REF}`
        : null);
    if (!baseRef) return;

    const previousSnapshot = readSnapshotAtRef(baseRef);

    const breakingChanges = findGraphqlBreakingChanges(
      previousSnapshot,
      graphqlSchemaSdl,
    );
    expect(
      breakingChanges,
      breakingChanges
        .map((change) => `${change.type}: ${change.description}`)
        .join("\n"),
    ).toEqual([]);

    const dangerousChanges = classifyGraphqlDangerousChanges(
      previousSnapshot,
      graphqlSchemaSdl,
    ).blocked;
    expect(
      dangerousChanges,
      dangerousChanges
        .map((change) => `${change.type}: ${change.description}`)
        .join("\n"),
    ).toEqual([]);
  });

  it("fails closed when a configured base snapshot cannot be read", () => {
    expect(() =>
      readSnapshotAtRef("refs/heads/__missing_graphql_contract_base__"),
    ).toThrow(
      "Unable to read GraphQL schema snapshot from configured base ref",
    );
  });
});
