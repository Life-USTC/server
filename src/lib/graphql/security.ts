import { EnvelopArmor } from "@escape.tech/graphql-armor";
import { useDisableIntrospection as disableIntrospectionPlugin } from "@graphql-yoga/plugin-disable-introspection";
import {
  GraphQLError,
  Kind,
  OperationTypeNode,
  type SelectionSetNode,
  type ValidationContext,
  type ValidationRule,
} from "graphql";
import {
  useExecutionCancellation as executionCancellationPlugin,
  type Plugin,
} from "graphql-yoga";
import { GRAPHQL_LIMITS } from "./constants";

function countTopLevelFields(
  selectionSet: SelectionSetNode,
  context: ValidationContext,
  fragmentStack = new Set<string>(),
): number {
  let count = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      count += 1;
      continue;
    }
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      count += countTopLevelFields(
        selection.selectionSet,
        context,
        fragmentStack,
      );
      continue;
    }

    const fragmentName = selection.name.value;
    if (fragmentStack.has(fragmentName)) continue;
    const fragment = context.getFragment(fragmentName);
    if (!fragment) continue;

    fragmentStack.add(fragmentName);
    count += countTopLevelFields(fragment.selectionSet, context, fragmentStack);
    fragmentStack.delete(fragmentName);
  }

  return count;
}

export const maxTopLevelFieldsRule: ValidationRule = (context) => ({
  OperationDefinition(node) {
    if (node.operation !== OperationTypeNode.QUERY) return;

    if (
      countTopLevelFields(node.selectionSet, context) >
      GRAPHQL_LIMITS.topLevelFields
    ) {
      context.reportError(
        new GraphQLError("Query has too many top-level fields.", {
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

export function createGraphqlSecurityPlugins(production: boolean) {
  const armor = new EnvelopArmor({
    blockFieldSuggestion: { enabled: true },
    costLimit: {
      maxCost: GRAPHQL_LIMITS.cost,
      exposeLimits: false,
    },
    maxAliases: {
      n: GRAPHQL_LIMITS.aliases,
      exposeLimits: false,
    },
    maxDepth: {
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
    ...(production ? [disableIntrospectionPlugin()] : []),
    executionCancellationPlugin(),
  ];
}
