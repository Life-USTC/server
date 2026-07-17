import { describe, expect, it } from "vitest";
import { findGraphqlBreakingChanges } from "@/lib/graphql/schema-diff";

const schema = (queryFields: string, extra = "") => `
  type Query {
    ${queryFields}
  }
  ${extra}
`;

describe("GraphQL schema breaking gate", () => {
  it.each([
    [
      "field deletion",
      schema("course: String\nsection: String"),
      schema("course: String"),
    ],
    [
      "argument deletion",
      schema("course(jwId: Int): String"),
      schema("course: String"),
    ],
    [
      "optional argument becoming required",
      schema("course(jwId: Int): String"),
      schema("course(jwId: Int!): String"),
    ],
    [
      "nullable output becoming non-null",
      schema("course: String"),
      schema("course: String!"),
    ],
    [
      "enum value deletion",
      schema("status: Status", "enum Status { ACTIVE RETIRED }"),
      schema("status: Status", "enum Status { ACTIVE }"),
    ],
  ])("detects %s", (_name, previousSdl, nextSdl) => {
    expect(findGraphqlBreakingChanges(previousSdl, nextSdl)).not.toHaveLength(
      0,
    );
  });

  it("allows additive fields", () => {
    expect(
      findGraphqlBreakingChanges(
        schema("course: String"),
        schema("course: String\nsection: String"),
      ),
    ).toHaveLength(0);
  });
});
