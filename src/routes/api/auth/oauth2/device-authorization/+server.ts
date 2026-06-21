import {
  deviceAuthorizationOptionsRoute,
  deviceAuthorizationPostRoute,
} from "@/lib/api/routes/auth-device-authorization";
import { svelteRequestHandler } from "@/lib/api/svelte-route";

export const OPTIONS = svelteRequestHandler(deviceAuthorizationOptionsRoute);

/**
 * Start OAuth 2.0 device authorization.
 * @body oauthDeviceAuthorizationRequestSchema
 * @response 200
 * @response 400:openApiErrorSchema
 */
export const POST = svelteRequestHandler(deviceAuthorizationPostRoute);
