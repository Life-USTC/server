import {
  authDeleteRoute,
  authGetRoute,
  authPatchRoute,
  authPostRoute,
  authPutRoute,
} from "@/lib/api/routes/auth";
import { svelteRequestHandler } from "@/lib/api/svelte-route";

export const GET = svelteRequestHandler(authGetRoute);
export const POST = svelteRequestHandler(authPostRoute);
export const PATCH = svelteRequestHandler(authPatchRoute);
export const PUT = svelteRequestHandler(authPutRoute);
export const DELETE = svelteRequestHandler(authDeleteRoute);
