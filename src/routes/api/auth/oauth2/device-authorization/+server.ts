import {
  deviceAuthorizationOptionsRoute,
  deviceAuthorizationPostRoute,
} from "@/lib/api/routes/auth-device-authorization";
import { svelteRequestHandler } from "@/lib/api/svelte-route";

export const OPTIONS = svelteRequestHandler(deviceAuthorizationOptionsRoute);

/**
 * Start OAuth 2.0 device authorization.
 * @body oauthDeviceAuthorizationRequestSchema
 * @response 200:oauthDeviceAuthorizationResponseSchema
 * @response 400:oauthErrorResponseSchema
 */
export const POST = svelteRequestHandler(deviceAuthorizationPostRoute);
