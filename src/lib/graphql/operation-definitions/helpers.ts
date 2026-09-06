import type { PersistedGraphqlOperationDefinition } from "../operation-types";

type QueryDefinitionInput = Omit<
  PersistedGraphqlOperationDefinition,
  "destructive" | "openWorld" | "readOnly" | "requiresConfirmation"
>;

type MutationDefinitionInput = Omit<
  PersistedGraphqlOperationDefinition,
  "readOnly" | "requiresConfirmation"
>;

export function query(
  input: QueryDefinitionInput,
): PersistedGraphqlOperationDefinition {
  return {
    ...input,
    destructive: false,
    openWorld: false,
    readOnly: true,
    requiresConfirmation: false,
  };
}

export function mutation(
  input: MutationDefinitionInput,
): PersistedGraphqlOperationDefinition {
  return {
    ...input,
    readOnly: false,
    requiresConfirmation: true,
  };
}
