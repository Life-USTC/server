import { resolveE2EBaseUrl } from "./base-url";

export function absoluteTestUrl(path: string, baseURL: string | undefined) {
  return new URL(path, baseURL ?? resolveE2EBaseUrl()).toString();
}
