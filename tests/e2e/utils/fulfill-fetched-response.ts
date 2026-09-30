import type { APIResponse, Route } from "@playwright/test";

/** Fulfill a real fetched response with framing that matches its exposed bytes. */
export async function fulfillFetchedResponse(route: Route, response: APIResponse) {
  const body = await response.body();
  const headers = response.headers();
  const status = response.status();
  // HEAD and 304 describe a representation without transferring its body.
  // Their existing length/encoding describe that representation, not these bytes.
  if (route.request().method() !== "HEAD" && ![204, 304].includes(status)) {
    // Match APIRequestContext's decoders; other encodings retain their
    // original bytes and representation header.
    if (
      ["gzip", "x-gzip", "br", "deflate"].includes(
        headers["content-encoding"]?.toLowerCase() ?? "",
      )
    )
      delete headers["content-encoding"];
    headers["content-length"] = String(body.length);
  } else if (status === 204) delete headers["content-length"];
  // The owned body buffer has no HTTP chunk delimiters.
  delete headers["transfer-encoding"];
  await route.fulfill({ response, body, headers });
}
