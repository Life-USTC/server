import { assertScalarType, buildSchema } from "graphql";
import { graphqlDateScalar, graphqlDateTimeScalar } from "./date-scalar";
import { graphqlTypeDefs } from "./schema";

function buildGraphqlOperationValidationSchema() {
  // Keep validation and AST analysis on this module's GraphQL.js realm. Yoga
  // can be loaded through a separate module realm under Vitest/worktree installs.
  const schema = buildSchema(graphqlTypeDefs);
  for (const implementation of [graphqlDateScalar, graphqlDateTimeScalar]) {
    const scalar = assertScalarType(schema.getType(implementation.name));
    scalar.serialize = implementation.serialize;
    scalar.parseValue = implementation.parseValue;
    scalar.parseLiteral = implementation.parseLiteral;
  }
  return schema;
}

export const graphqlOperationValidationSchema =
  buildGraphqlOperationValidationSchema();
