import { error } from "@sveltejs/kit";
import { allowDebugAuth } from "@/lib/auth/auth-config";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = () => {
  if (!allowDebugAuth()) error(404, "Not Found");
};
