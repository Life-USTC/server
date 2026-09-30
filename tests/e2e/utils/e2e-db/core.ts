import { resolveE2EBaseUrl } from "../base-url";

export const PLAYWRIGHT_BASE_URL = resolveE2EBaseUrl();

export function generateToken(bytes = 24) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
