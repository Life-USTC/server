import { buildSchema, parse, validate } from "graphql";
import { describe, expect, it } from "vitest";
import { GRAPHQL_LIMITS } from "@/lib/graphql/constants";
import { analyzeGraphqlOperation } from "@/lib/graphql/operation-analysis";
import { maxTopLevelFieldsRule } from "@/lib/graphql/security";

describe("GraphQL operation analysis", () => {
  it("expands fragments and weights pageSize variables with the security cost model", () => {
    const document = parse(/* GraphQL */ `
      query Catalog($page: PageInput) {
        ...CatalogRoot
      }

      fragment CatalogRoot on Query {
        courses(page: $page) {
          ...CoursePageFields
        }
        currentSemester {
          jwId
        }
      }

      fragment CoursePageFields on CoursePage {
        items {
          jwId
          code
        }
        pageInfo {
          total
        }
      }
    `);

    expect(
      analyzeGraphqlOperation({
        document,
        operationName: "Catalog",
        variables: { page: { pageSize: 37 } },
      }),
    ).toEqual({
      estimatedCost: 336,
      operationName: "Catalog",
      operationType: "query",
      topLevelFieldCount: 2,
    });
  });

  it("reports anonymous and unselected operations without using raw input names", () => {
    const anonymous = parse("{ currentSemester { jwId } }");
    expect(
      analyzeGraphqlOperation({
        document: anonymous,
        variables: {},
      }),
    ).toMatchObject({
      operationName: "anonymous",
      operationType: "query",
    });

    const multiple = parse(
      "query First { currentSemester { jwId } } query Second { currentSemester { jwId } }",
    );
    expect(
      analyzeGraphqlOperation({
        document: multiple,
        operationName: "private-unmatched-name",
        variables: {},
      }),
    ).toEqual({
      estimatedCost: 0,
      operationName: "unknown",
      operationType: "unknown",
      topLevelFieldCount: 0,
    });
  });

  it("applies the top-level field limit to mutations as well as queries", () => {
    const schema = buildSchema(`
      type Query { ok: Boolean! }
      type Mutation { setValue(value: Int!): Boolean! }
    `);
    const mutation = parse(`
      mutation TooWide {
        ${Array.from(
          { length: GRAPHQL_LIMITS.topLevelFields + 1 },
          (_, index) => `m${index}: setValue(value: ${index})`,
        ).join("\n")}
      }
    `);

    expect(validate(schema, mutation, [maxTopLevelFieldsRule])).toEqual([
      expect.objectContaining({
        message: "Mutation has too many top-level fields.",
      }),
    ]);
  });
});
