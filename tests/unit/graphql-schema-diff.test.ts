import { describe, expect, it } from "vitest";
import {
  classifyGraphqlDangerousChanges,
  findGraphqlBreakingChanges,
} from "@/lib/graphql/schema-diff";

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

describe("GraphQL dangerous-change policy", () => {
  it.each([
    [
      "enum value additions",
      schema("status: Status", "enum Status { ACTIVE }"),
      schema("status: Status", "enum Status { ACTIVE RETIRED }"),
      /Status/,
    ],
    [
      "argument default changes",
      schema("course(limit: Int = 10): String"),
      schema("course(limit: Int = 20): String"),
      /Query\.course/,
    ],
    [
      "input-field default changes",
      schema(
        "search(input: SearchInput): String",
        "input SearchInput { limit: Int = 10 }",
      ),
      schema(
        "search(input: SearchInput): String",
        "input SearchInput { limit: Int = 20 }",
      ),
      /SearchInput\.limit/,
    ],
    [
      "input-field default additions",
      schema(
        "search(input: SearchInput): String",
        "input SearchInput { limit: Int }",
      ),
      schema(
        "search(input: SearchInput): String",
        "input SearchInput { limit: Int = 10 }",
      ),
      /SearchInput\.limit/,
    ],
    [
      "input-field default removals",
      schema(
        "search(input: SearchInput): String",
        "input SearchInput { limit: Int = 10 }",
      ),
      schema(
        "search(input: SearchInput): String",
        "input SearchInput { limit: Int }",
      ),
      /SearchInput\.limit/,
    ],
    [
      "union member additions",
      schema(
        "search: SearchResult",
        "type Course { id: ID! } union SearchResult = Course",
      ),
      schema(
        "search: SearchResult",
        "type Course { id: ID! } type Teacher { id: ID! } union SearchResult = Course | Teacher",
      ),
      /SearchResult|Teacher/,
    ],
    [
      "implemented interface additions",
      schema(
        "result: Result",
        "interface Node { id: ID! } type Result { id: ID! }",
      ),
      schema(
        "result: Result",
        "interface Node { id: ID! } type Result implements Node { id: ID! }",
      ),
      /Result|Node/,
    ],
  ])("blocks %s with a coordinate in the diagnostic", (_name, previousSdl, nextSdl, coordinate) => {
    const { blocked } = classifyGraphqlDangerousChanges(previousSdl, nextSdl);
    expect(blocked).not.toHaveLength(0);
    expect(blocked[0].description).toMatch(coordinate);
  });

  it.each([
    [
      "optional arguments",
      schema("course: String"),
      schema("course(limit: Int): String"),
    ],
    [
      "optional input fields",
      schema(
        "search(input: SearchInput): String",
        "input SearchInput { query: String }",
      ),
      schema(
        "search(input: SearchInput): String",
        "input SearchInput { query: String, limit: Int }",
      ),
    ],
  ])("allows additive %s under SDL review", (_name, previousSdl, nextSdl) => {
    const changes = classifyGraphqlDangerousChanges(previousSdl, nextSdl);
    expect(changes.blocked).toEqual([]);
    expect(changes.allowed).not.toHaveLength(0);
  });
});
