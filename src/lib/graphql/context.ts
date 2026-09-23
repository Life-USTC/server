import type { AppLocale } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { type GraphqlPrincipal, resolveGraphqlPrincipal } from "./auth";
import { createGraphqlLoaders, type GraphqlLoaders } from "./loaders";

export type GraphqlContext = {
  loaders: GraphqlLoaders;
  locale: AppLocale;
  principal: GraphqlPrincipal;
  request: Request;
};

export type GraphqlServerContext = {
  locals: { locale?: AppLocale; requestId?: string };
  operationObservation?: "caller";
  principal?: GraphqlPrincipal;
  principalRef?: { current?: GraphqlPrincipal };
};

export async function createGraphqlContext(
  serverContext: GraphqlServerContext & { request: Request },
): Promise<GraphqlContext> {
  const { locals, request } = serverContext;
  const locale = locals.locale ?? DEFAULT_LOCALE;
  const principal =
    serverContext.principal ?? (await resolveGraphqlPrincipal(request));
  serverContext.principal = principal;
  if (serverContext.principalRef) {
    serverContext.principalRef.current = principal;
  }
  return {
    loaders: createGraphqlLoaders(locale),
    locale,
    principal,
    request,
  };
}
