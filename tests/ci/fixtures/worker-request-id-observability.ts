import { responseWithRequestId } from "../../../src/lib/log/worker-entrypoint-observability";

const REQUEST_IDS = {
  disturbed: "33333333-3333-4333-8333-333333333333",
  encoding: "44444444-4444-4444-8444-444444444444",
  locked: "22222222-2222-4222-8222-222222222222",
  metadata: "11111111-1111-4111-8111-111111111111",
  nonImmutable: "55555555-5555-4555-8555-555555555555",
  redirect: "66666666-6666-4666-8666-666666666666",
  websocket: "77777777-7777-4777-8777-777777777777",
};

function forceImmutable(response: Response) {
  response.headers.set = () => {
    throw new TypeError("Can't modify immutable headers.");
  };
  return response;
}

function responseCf(response: Response) {
  if (!("cf" in response)) return undefined;
  return (response as Response & { readonly cf?: unknown }).cf;
}

function responseCookies(response: Response) {
  return (
    response.headers as Headers & {
      getAll(name: string): string[];
    }
  ).getAll("set-cookie");
}

function errorDescription(error: unknown) {
  if (error instanceof Error) return `${error.name}:${error.message}`;
  return String(error);
}

async function compressedBody(value: string) {
  const source = new Response(value);
  const compressed = source.body?.pipeThrough(new CompressionStream("gzip"));
  if (!compressed) throw new Error("Expected a source response body");
  return new Response(compressed).arrayBuffer();
}

async function metadataResponse() {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("streamed"));
      controller.close();
    },
  });
  const original = forceImmutable(
    new Response(stream, {
      status: 206,
      statusText: "Partial Content",
      headers: {
        "Content-Encoding": "gzip",
        "Set-Cookie": "session=one",
      },
      cf: { cacheStatus: "HIT" },
      encodeBody: "manual",
    }),
  );
  original.headers.append("Set-Cookie", "theme=dark");
  const observed = responseWithRequestId(original, REQUEST_IDS.metadata);
  const bodySame = observed.body === original.body;
  const body = await observed.text();
  return Response.json({
    body,
    bodySame,
    cf: responseCf(observed),
    contentEncoding: observed.headers.get("content-encoding"),
    cookies: responseCookies(observed),
    requestId: observed.headers.get("x-request-id"),
    status: observed.status,
    statusText: observed.statusText,
  });
}

async function encodingResponse() {
  const original = forceImmutable(
    new Response(await compressedBody("encoded"), {
      headers: { "Content-Encoding": "gzip" },
      encodeBody: "manual",
    }),
  );
  return responseWithRequestId(original, REQUEST_IDS.encoding);
}

function websocketResponse() {
  const pair = new WebSocketPair();
  pair[1].accept();
  const original = forceImmutable(
    new Response(null, { status: 101, webSocket: pair[0] }),
  );
  try {
    const observed = responseWithRequestId(original, REQUEST_IDS.websocket);
    return Response.json({
      hasWebSocket:
        "webSocket" in observed &&
        Boolean(
          (observed as Response & { readonly webSocket?: unknown }).webSocket,
        ),
      requestId: observed.headers.get("x-request-id"),
      status: observed.status,
    });
  } finally {
    pair[0].accept();
    pair[0].close();
    pair[1].close();
  }
}

function lockedResponse() {
  const original = forceImmutable(new Response("locked"));
  const reader = original.body?.getReader();
  let error = "none";
  try {
    responseWithRequestId(original, REQUEST_IDS.locked);
  } catch (caught) {
    error = errorDescription(caught);
  } finally {
    reader?.releaseLock();
  }
  return Response.json({ error });
}

async function disturbedResponse() {
  const original = forceImmutable(new Response("disturbed"));
  await original.text();
  let error = "none";
  try {
    responseWithRequestId(original, REQUEST_IDS.disturbed);
  } catch (caught) {
    error = errorDescription(caught);
  }
  return Response.json({ error });
}

function nonImmutableResponse() {
  const original = new Response("unavailable");
  original.headers.set = () => {
    throw new TypeError("header sink unavailable");
  };
  let error = "none";
  try {
    responseWithRequestId(original, REQUEST_IDS.nonImmutable);
  } catch (caught) {
    error = errorDescription(caught);
  }
  return Response.json({ error });
}

function redirectResponse() {
  const original = Response.redirect("https://example.test/target", 302);
  let immutableError = "none";
  try {
    original.headers.set("x-test", "value");
  } catch (error) {
    immutableError = errorDescription(error);
  }
  const observed = responseWithRequestId(original, REQUEST_IDS.redirect);
  return Response.json({
    immutableError,
    location: observed.headers.get("location"),
    requestId: observed.headers.get("x-request-id"),
    same: observed === original,
    status: observed.status,
    statusText: observed.statusText,
  });
}

export default {
  async fetch(request: Request) {
    switch (new URL(request.url).pathname) {
      case "/disturbed":
        return disturbedResponse();
      case "/encoding":
        return encodingResponse();
      case "/locked":
        return lockedResponse();
      case "/metadata":
        return metadataResponse();
      case "/non-immutable":
        return nonImmutableResponse();
      case "/redirect":
        return redirectResponse();
      case "/websocket":
        return websocketResponse();
      default:
        return new Response("Not found", { status: 404 });
    }
  },
};
