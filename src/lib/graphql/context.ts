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
  principal?: GraphqlPrincipal;
};

export async function createGraphqlContext({
  locals,
  principal,
  request,
}: GraphqlServerContext & { request: Request }): Promise<GraphqlContext> {
  const locale = locals.locale ?? DEFAULT_LOCALE;
  return {
    loaders: createGraphqlLoaders(locale),
    locale,
    principal: principal ?? (await resolveGraphqlPrincipal(request)),
    request,
  };
}
