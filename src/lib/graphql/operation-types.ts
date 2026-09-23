export type PersistedGraphqlOperationDefinition = Readonly<{
  description: string;
  destructive: boolean;
  document: string;
  id: string;
  openWorld: boolean;
  readOnly: boolean;
  requiresConfirmation: boolean;
  scopes: readonly string[];
  title: string;
}>;
