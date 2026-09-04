import { buildSchema, isObjectType, parse, validate } from "graphql";
import { describe, expect, it } from "vitest";
import { GRAPHQL_LIMITS } from "@/lib/graphql/constants";
import {
  analyzeGraphqlOperation,
  PAGINATED_FIELD_COORDINATES,
} from "@/lib/graphql/operation-analysis";
import { maxTopLevelFieldsRule } from "@/lib/graphql/security";
import { graphqlOperationValidationSchema } from "@/lib/graphql/validation-schema";

describe("GraphQL operation analysis", () => {
  it("classifies every PageInput field by schema coordinate", () => {
    const actual = Object.values(
      graphqlOperationValidationSchema.getTypeMap(),
    ).flatMap((type) =>
      isObjectType(type)
        ? Object.values(type.getFields()).flatMap((field) =>
            field.args.some(
              (argument) =>
                argument.name === "page" &&
                argument.type.toString().replace(/!/g, "") === "PageInput",
            )
              ? [`${type.name}.${field.name}`]
              : [],
          )
        : [],
    );

    expect([...PAGINATED_FIELD_COORDINATES].sort()).toEqual(actual.sort());
  });
  it("expands fragments and weights pageSize variables with the security cost model", () => {
    const document = parse(/* GraphQL */ `
      query Catalog($page: PageInput) {
        catalog {
          ...CatalogRoot
        }
      }

      fragment CatalogRoot on Catalog {
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
      estimatedCost: 338,
      operationName: "Catalog",
      operationType: "query",
      topLevelFieldCount: 1,
    });
  });

  it("reports anonymous and unselected operations without using raw input names", () => {
    const anonymous = parse("{ catalog { currentSemester { jwId } } }");
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
      "query First { catalog { currentSemester { jwId } } } query Second { catalog { currentSemester { jwId } } }",
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

  it("weights every authenticated Workspace collection by its pageSize", () => {
    const document = parse(/* GraphQL */ `
      query ViewerPages($page: PageInput) {
        workspace {
          todos(page: $page) {
            pageInfo { total }
          }
          subscribedSections(page: $page) {
            pageInfo { total }
          }
          homeworks(page: $page) {
            pageInfo { total }
          }
          schedules(page: $page) {
            pageInfo { total }
          }
          exams(page: $page) {
            pageInfo { total }
          }
        }
      }
    `);

    expect(
      analyzeGraphqlOperation({
        document,
        operationName: "ViewerPages",
        variables: { page: { pageSize: 10 } },
      }),
    ).toEqual({
      estimatedCost: 252,
      operationName: "ViewerPages",
      operationType: "query",
      topLevelFieldCount: 1,
    });
  });

  it("weights nested Schedule teachers and Exam rooms by their pageSize", () => {
    const document = parse(/* GraphQL */ `
      query NestedViewerPages($page: PageInput) {
        workspace {
          schedules {
            items {
              teachers(page: $page) {
                items { id }
              }
            }
          }
          exams {
            items {
              examRooms(page: $page) {
                items { id }
              }
            }
          }
        }
      }
    `);

    expect(
      analyzeGraphqlOperation({
        document,
        operationName: "NestedViewerPages",
        variables: { page: { pageSize: 10 } },
      }),
    ).toEqual({
      estimatedCost: 2162,
      operationName: "NestedViewerPages",
      operationType: "query",
      topLevelFieldCount: 1,
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
