import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { graphqlSchemaSdl } from "@/lib/graphql/resources";
import { findGraphqlBreakingChanges } from "@/lib/graphql/schema-diff";

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
  } catch {
    return null;
  }
}

describe("GraphQL schema snapshot", () => {
  it("matches the canonical SDL file", async () => {
    await expect(graphqlSchemaSdl).toMatchFileSnapshot(snapshotPath);
  });

  it("does not break the configured base schema", () => {
    const baseRef =
      process.env.GRAPHQL_SCHEMA_BASE_REF ??
      (process.env.GITHUB_BASE_REF
        ? `origin/${process.env.GITHUB_BASE_REF}`
        : null);
    if (!baseRef) return;

    const previousSnapshot = readSnapshotAtRef(baseRef);
    if (!previousSnapshot) return;

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
  });
});
