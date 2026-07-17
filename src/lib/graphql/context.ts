import {
  type GraphqlPrincipal,
  resolveGraphqlPrincipal,
} from "@/lib/graphql/auth";

export type GraphqlAuthContext = {
  principal: GraphqlPrincipal;
};

export async function createGraphqlAuthContext(
  request: Request,
): Promise<GraphqlAuthContext> {
  return {
    principal: await resolveGraphqlPrincipal(request),
  };
}
