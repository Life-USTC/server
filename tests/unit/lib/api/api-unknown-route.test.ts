import { describe, expect, test } from "vitest";
import { fallback } from "@/routes/api/[...path]/+server";

describe("unknown API catch-all", () => {
  test("returns the standard JSON not-found envelope", async () => {
    const response = await fallback({} as never);

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });
});
