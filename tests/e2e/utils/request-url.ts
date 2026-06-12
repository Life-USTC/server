export function absoluteTestUrl(path: string, baseURL: string | undefined) {
  return new URL(path, baseURL ?? "http://127.0.0.1:3000").toString();
}
