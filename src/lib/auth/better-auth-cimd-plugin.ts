import { createCimdClientDiscovery } from "@better-auth/cimd";
import { extendOAuthProvider } from "@better-auth/oauth-provider";
import type { BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth/api";
import {
  allowCimdMetadataFetch,
  fetchCimdMetadataResource,
} from "./cimd-fetch-policy";

export function buildBetterAuthCimdPlugin() {
  const discovery = createCimdClientDiscovery({
    fetchClientMetadataResource: fetchCimdMetadataResource,
    isMetadataDocumentUrlAllowed: allowCimdMetadataFetch,
    metadataProfile: "mcp-2026-07-28",
  });
  return {
    id: "cimd",
    init(context) {
      extendOAuthProvider(context, {
        clientDiscovery: {
          ...discovery,
          async resolve(...args) {
            try {
              return await discovery.resolve(...args);
            } catch (error) {
              // Invalid fetched registration metadata means the URL cannot
              // identify an admissible client at the authorization endpoint.
              if (
                error instanceof APIError &&
                error.body?.error === "invalid_client_metadata"
              ) {
                throw new APIError("BAD_REQUEST", {
                  ...error.body,
                  error: "invalid_client",
                });
              }
              throw error;
            }
          },
        },
      });
    },
  } satisfies BetterAuthPlugin;
}
