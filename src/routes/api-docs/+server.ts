import { type RequestHandler, redirect } from "@sveltejs/kit";

export const GET: RequestHandler = () => {
  throw redirect(308, "/api/docs/tag/sections");
};
