import { jsonResponse } from "@/lib/api/helpers";

export function deviceCodeError(error: string, status = 400) {
  return jsonResponse({ error }, { status });
}
