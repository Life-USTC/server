import type { RequestEvent } from "@sveltejs/kit";
import { DEV } from "esm-env";
import { runCloudflareTraceSpan } from "@/lib/adapters/cloudflare-runtime";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { observedApiRoute } from "@/lib/log/api-observability";
import type { RequestHandler } from "./$types";

export const trailingSlash = "ignore";

// `DEV` resolves through the final bundler's export conditions, so the
// NODE_ENV=development test-Worker rebundle keeps GraphiQL and
// introspection while production stays hardened. SvelteKit 3's `dev` is
// baked to `false` at vite build time and no longer flips there.
const handleGraphqlRequest = createGraphqlRequestHandler(!DEV);
const observedGraphqlRoute = observedApiRoute(
  (_request: Request, event: RequestEvent) =>
    runCloudflareTraceSpan("graphql.request", {}, () =>
      handleGraphqlRequest(event),
    ),
);
const handle: RequestHandler = (event) =>
  observedGraphqlRoute(event.request, event);

export { handle as GET, handle as OPTIONS, handle as POST };
