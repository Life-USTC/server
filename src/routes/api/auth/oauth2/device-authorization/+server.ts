import {
  deviceAuthorizationOptionsRoute,
  deviceAuthorizationPostRoute,
} from "@/lib/api/routes/auth-device-authorization";
import { svelteRequestHandler } from "@/lib/api/svelte-route";

export const OPTIONS = svelteRequestHandler(deviceAuthorizationOptionsRoute);
export const POST = svelteRequestHandler(deviceAuthorizationPostRoute);
