import type { RequestHandler } from "@sveltejs/kit";
import { notFound } from "@/lib/api/helpers";

export const fallback: RequestHandler = () => notFound();
