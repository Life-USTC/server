import { EnvelopArmor } from "@escape.tech/graphql-armor";
import { useDisableIntrospection as disableIntrospectionPlugin } from "@graphql-yoga/plugin-disable-introspection";
import { GraphQLError, OperationTypeNode, type ValidationRule } from "graphql";
import {
  useExecutionCancellation as executionCancellationPlugin,
  type Plugin,
} from "graphql-yoga";
import { GRAPHQL_LIMITS } from "./constants";
import {
  analyzeGraphqlOperation,
  countGraphqlTopLevelFields,
} from "./operation-analysis";

export const maxTopLevelFieldsRule: ValidationRule = (context) => ({
  OperationDefinition(node) {
    if (
      node.operation !== OperationTypeNode.QUERY &&
      node.operation !== OperationTypeNode.MUTATION
    ) {
      return;
    }

    if (
      countGraphqlTopLevelFields(context.getDocument(), node) >
      GRAPHQL_LIMITS.topLevelFields
    ) {
      const operationLabel =
        node.operation === OperationTypeNode.MUTATION ? "Mutation" : "Query";
      context.reportError(
        new GraphQLError(`${operationLabel} has too many top-level fields.`, {
          nodes: node,
          extensions: { code: "GRAPHQL_VALIDATION_FAILED" },
        }),
      );
    }
  },
});

const topLevelFieldPlugin: Plugin = {
  onValidate({ addValidationRule }) {
    addValidationRule(maxTopLevelFieldsRule);
  },
};

const operationCostPlugin: Plugin = {
  onExecute({ args, setResultAndStopExecution }) {
    const analysis = analyzeGraphqlOperation({
      document: args.document,
      operationName: args.operationName,
      variables: args.variableValues ?? {},
    });
    if (analysis.estimatedCost <= GRAPHQL_LIMITS.cost) return;

    setResultAndStopExecution({
      errors: [
        new GraphQLError("Query cost limit exceeded.", {
          extensions: { code: "GRAPHQL_VALIDATION_FAILED" },
        }),
      ],
    });
  },
};

export function createGraphqlSecurityPlugins(production: boolean) {
  const armor = new EnvelopArmor({
    blockFieldSuggestion: { enabled: true },
    maxAliases: {
      n: GRAPHQL_LIMITS.aliases,
      exposeLimits: false,
    },
    maxDepth: {
      errorMessage: "Query depth limit exceeded.",
      n: GRAPHQL_LIMITS.depth,
      exposeLimits: false,
      flattenFragments: true,
    },
    maxDirectives: {
      n: GRAPHQL_LIMITS.directives,
      exposeLimits: false,
    },
    maxTokens: {
      n: GRAPHQL_LIMITS.tokens,
      exposeLimits: false,
    },
  });

  return [
    ...armor.protect().plugins,
    topLevelFieldPlugin,
    operationCostPlugin,
    ...(production ? [disableIntrospectionPlugin()] : []),
    executionCancellationPlugin(),
  ];
}
