import { createRequire } from "node:module";
import { execute } from "@graphql-tools/executor";
import { describe, expect, it } from "vitest";

// Match the external executor's Node GraphQL instance, as in schema audits.
const {
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  parse,
} = createRequire(import.meta.url)("graphql") as typeof import("graphql");

describe("GraphQL executor compatibility", () => {
  it("keeps variable directives isolated when the same AST is reused", async () => {
    const item = new GraphQLObjectType({
      name: "Item",
      fields: { id: { type: GraphQLInt }, name: { type: GraphQLString } },
    });
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: "Query",
        fields: {
          item: {
            type: item,
            args: { id: { type: GraphQLInt } },
            resolve: (_source, args) => ({ id: args.id, name: "Visible" }),
          },
        },
      }),
    });
    const document = parse(`query($id:Int!, $hide:Boolean!, $show:Boolean!) {
      item(id:$id) @skip(if:$hide) { id ...Name @include(if:$show) }
    } fragment Name on Item { name }`);
    for (const [variables, data] of [
      [
        { id: 1, hide: false, show: true },
        { item: { id: 1, name: "Visible" } },
      ],
      [{ id: 2, hide: false, show: false }, { item: { id: 2 } }],
      [{ id: 1, hide: true, show: true }, {}],
      [
        { id: 1, hide: false, show: true },
        { item: { id: 1, name: "Visible" } },
      ],
    ] as const) {
      expect(
        await execute({ schema, document, variableValues: variables }),
      ).toEqual({ data });
    }
  });

  it.each([
    ["nullable null item", [1, null, 3], false, false, [1, null, 3], false],
    [
      "nullable serialization failure",
      [1, "invalid", 3],
      false,
      false,
      [1, null, 3],
      true,
    ],
    [
      "non-null item bubbles to nullable list",
      [1, null, 3],
      true,
      false,
      null,
      true,
    ],
    [
      "non-null list bubbles to root",
      [1, "invalid", 3],
      true,
      true,
      null,
      true,
    ],
  ] as const)(
    "preserves scalar list semantics: %s",
    async (_name, values, requiredItem, requiredList, expected, failed) => {
      const item = requiredItem ? new GraphQLNonNull(GraphQLInt) : GraphQLInt;
      const list = new GraphQLList(item);
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: "Query",
          fields: {
            values: {
              type: requiredList ? new GraphQLNonNull(list) : list,
              resolve: () => values,
            },
          },
        }),
      });
      const result = await execute({
        schema,
        document: parse("{ alias: values }"),
      });
      if ("initialResult" in result)
        throw new Error("Unexpected incremental execution");
      expect(result.data).toEqual(
        requiredList && failed ? null : { alias: expected },
      );
      expect(result.errors?.map((error) => error.path)).toEqual(
        failed ? [["alias", 1]] : undefined,
      );
    },
  );

  it.each([false, true])(
    "preserves indexed promise rejection with non-null item %s",
    async (requiredItem) => {
      const failure = new Error("owned scalar-list rejection");
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: "Query",
          fields: {
            values: {
              type: new GraphQLList(
                requiredItem ? new GraphQLNonNull(GraphQLInt) : GraphQLInt,
              ),
              // Rejection is created inside execution, where the executor owns its handler.
              resolve: () => [
                Promise.resolve(1),
                Promise.reject(failure),
                Promise.resolve(3),
              ],
            },
          },
        }),
      });
      const result = await execute({
        schema,
        document: parse("{ alias: values }"),
      });
      if ("initialResult" in result)
        throw new Error("Unexpected incremental execution");
      expect(result.data).toEqual({
        alias: requiredItem ? null : [1, null, 3],
      });
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].path).toEqual(["alias", 1]);
      expect(result.errors?.[0].originalError).toBe(failure);
    },
  );
});
