import { withBetterAuthOAuthDebug } from "@/lib/log/oauth-debug";
import {
  enforceAuthorizationCodeGrantBinding,
  maybeNormalizeAuthorizeLoopbackRedirectRequest,
  maybeNormalizeAuthorizeResourceRequest,
  resolveAuthorizationCodeGrantExpectation,
} from "./auth-authorize-grant-binding";
import {
  prepareOAuthClientRegistrationRequest,
  restoreDeviceRegistrationGrantTypes,
} from "./auth-client-registration";
import {
  handleOAuthConsentMutation,
  oauthConsentMutationPath,
} from "./auth-consent";
import {
  enforceIntrospectionGrant,
  isOAuthIntrospectionRequest,
  prepareIntrospectionParams,
} from "./auth-introspection";

async function authHandler(request: Request) {
  const { betterAuthInstance } = await import("@/lib/auth/core");
  return betterAuthInstance.handler(request);
}

export const authGetRoute = async (request: Request) => {
  const normalizedRequest =
    await maybeNormalizeAuthorizeLoopbackRedirectRequest(
      maybeNormalizeAuthorizeResourceRequest(request),
    );
  const expectation =
    await resolveAuthorizationCodeGrantExpectation(normalizedRequest);
  const response = await withBetterAuthOAuthDebug(
    "GET",
    normalizedRequest,
    authHandler,
  );
  return enforceAuthorizationCodeGrantBinding(
    normalizedRequest,
    response,
    expectation,
  );
};

export const authPostRoute = async (request: Request) => {
  const consentMutation = oauthConsentMutationPath(request);
  if (consentMutation) {
    return handleOAuthConsentMutation(request, consentMutation);
  }
  const introspection = isOAuthIntrospectionRequest(request)
    ? await prepareIntrospectionParams(request)
    : null;
  if (introspection && "response" in introspection) {
    return introspection.response;
  }
  const prepared = await prepareOAuthClientRegistrationRequest(request);
  if ("response" in prepared) return prepared.response;
  const expectation = await resolveAuthorizationCodeGrantExpectation(
    prepared.request,
  );
  const response = await withBetterAuthOAuthDebug(
    "POST",
    prepared.request,
    authHandler,
  );
  const restored = await restoreDeviceRegistrationGrantTypes(
    response,
    prepared.deviceRegistration,
  );
  const finalized =
    introspection && "params" in introspection
      ? enforceIntrospectionGrant(
          prepared.request,
          introspection.params,
          restored,
        )
      : restored;
  return enforceAuthorizationCodeGrantBinding(
    prepared.request,
    await finalized,
    expectation,
  );
};

export const authPatchRoute = (request: Request) =>
  withBetterAuthOAuthDebug("PATCH", request, authHandler);

export const authPutRoute = (request: Request) =>
  withBetterAuthOAuthDebug("PUT", request, authHandler);

export const authDeleteRoute = (request: Request) =>
  withBetterAuthOAuthDebug("DELETE", request, authHandler);
