import { expect, it } from "vitest";
import {
  badRequest,
  createdJsonResponse,
  errorResponse,
  forbidden,
  jsonResponse,
  notFound,
  rateLimitResponse,
  recentAuthenticationRequired,
  suspensionForbidden,
  unauthorized,
} from "@/lib/api/responses";

it("rendering-and-cache.personal-overlays-8", async () => {
  const responses = [
    jsonResponse({ value: "private data" }),
    createdJsonResponse({ id: "created" }, "/created"),
    badRequest("invalid input"),
    unauthorized(),
    forbidden(),
    recentAuthenticationRequired(),
    suspensionForbidden(),
    notFound(),
    rateLimitResponse("limited"),
    rateLimitResponse("unavailable"),
    errorResponse("failure", 500),
  ];
  for (const response of responses) {
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(await response.json()).toBeTypeOf("object");
  }
});
