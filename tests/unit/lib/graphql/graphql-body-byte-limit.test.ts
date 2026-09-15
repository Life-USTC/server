import { describe, expect, it } from "vitest";
import {
  GRAPHQL_LIMITS,
  isWithinGraphqlBodyByteLimit,
} from "@/lib/graphql/constants";

describe("GraphQL body byte limit", () => {
  it("counts UTF-8 bytes instead of JavaScript characters", () => {
    expect(
      isWithinGraphqlBodyByteLimit("x".repeat(GRAPHQL_LIMITS.bodyBytes)),
    ).toBe(true);
    expect(
      isWithinGraphqlBodyByteLimit("课".repeat(GRAPHQL_LIMITS.bodyBytes / 3)),
    ).toBe(true);
    expect(
      isWithinGraphqlBodyByteLimit(
        `课${"x".repeat(GRAPHQL_LIMITS.bodyBytes - 2)}`,
      ),
    ).toBe(false);
  });
});
