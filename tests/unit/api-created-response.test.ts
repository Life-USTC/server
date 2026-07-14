import { describe, expect, it } from "vitest";
import { createdJsonResponse } from "@/lib/api/responses";

describe("createdJsonResponse", () => {
  it("returns 201 with the relative resource location", async () => {
    const response = createdJsonResponse({ id: "todo-1" }, "/api/todos/todo-1");

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe("/api/todos/todo-1");
    await expect(response.json()).resolves.toEqual({ id: "todo-1" });
  });
});
