const handlers = {
  HEAD() {
    return new Response(null, { status: 204 });
  },
  OPTIONS() {
    return new Response(null, { status: 204 });
  },
};

export function GET() {
  return new Response("{}");
}

export const { HEAD, OPTIONS } = handlers;
