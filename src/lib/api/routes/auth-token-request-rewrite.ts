export function rewriteTokenFormRequest(
  request: Request,
  params: URLSearchParams,
) {
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  return new Request(request.url, {
    method: request.method,
    headers,
    body: params.toString(),
  });
}
