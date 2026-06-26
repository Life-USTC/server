import { jsonResponse } from "@/lib/api/helpers";

export const DEVICE_AUTH_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export function deviceAuthJsonError(
  status: number,
  error: string,
  error_description: string,
) {
  return jsonResponse(
    { error, error_description },
    {
      status,
      headers: DEVICE_AUTH_CORS_HEADERS,
    },
  );
}
