/**
 * Check process liveness.
 * @response 200:text
 */
export function GET() {
  return new Response("ok\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
