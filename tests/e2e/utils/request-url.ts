export function absoluteTestUrl(path: string, baseURL: string | undefined) {
  if (!baseURL) throw new Error("A private test origin is required");
  return new URL(path, baseURL).toString();
}
