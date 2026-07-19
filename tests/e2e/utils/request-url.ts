export function absoluteTestUrl(path: string, baseURL: string | undefined) {
  return new URL(path, baseURL ?? "http://localhost:3000").toString();
}
