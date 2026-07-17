import type { RequestEvent } from "@sveltejs/kit";
import { createGraphqlRequestHandler } from "@/lib/graphql/server";
import { observedApiRoute } from "@/lib/log/api-observability";
import { dev } from "$app/environment";
import type { RequestHandler } from "./$types";

export const trailingSlash = "ignore";

const handleGraphqlRequest = createGraphqlRequestHandler(!dev);
const observedGraphqlRoute = observedApiRoute(
  (_request: Request, event: RequestEvent) => handleGraphqlRequest(event),
);

const handle: RequestHandler = (event) =>
  observedGraphqlRoute(event.request, event);

export { handle as GET, handle as OPTIONS, handle as POST };
