import { createOAuthDiscoveryRoute } from "@/lib/oauth/discovery-routes";

export const { GET, OPTIONS } = createOAuthDiscoveryRoute("openIdMetadata");
