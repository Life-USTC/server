import { tokenGetRoute, tokenPostRoute } from "@/lib/api/routes/auth-token";
import { svelteRequestHandler } from "@/lib/api/svelte-route";

export const POST = svelteRequestHandler(tokenPostRoute);
export const GET = svelteRequestHandler(tokenGetRoute);
