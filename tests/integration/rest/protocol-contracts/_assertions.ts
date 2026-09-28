import { expect } from "@playwright/test";
import type { OperationResult, Transport } from "./_transport";

export function expectSuccessfulOperation(
  transport: Transport,
  result: OperationResult,
) {
  expect(result.response.status, JSON.stringify(result.payload)).toBe(200);
  if (transport === "graphql") expect(result.payload.errors).toBeUndefined();
  if (transport === "mcp") {
    expect(result.payload.error).toBeUndefined();
    expect(result.payload.result.isError).not.toBe(true);
    expect(result.content.success).toBe(true);
  }
  return result.content;
}
export function expectAuthorizationRejected(
  transport: Transport,
  result: OperationResult,
  reason: "anonymous" | "read_scope",
) {
  expect(result.response.status).toBe(
    reason === "anonymous" || transport === "rest" ? 401 : 403,
  );
  if (transport === "graphql")
    expect(result.payload.errors[0].extensions.code).toBe(
      reason === "anonymous" ? "UNAUTHENTICATED" : "FORBIDDEN",
    );
  if (transport === "mcp") expect(result.payload.error).toBeDefined();
}
