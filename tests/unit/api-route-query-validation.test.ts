import { describe, expect, it } from "vitest";
import { getCoursesRoute } from "@/lib/api/routes/academic-course-routes";
import { getSchedulesRoute } from "@/lib/api/routes/academic-schedule-routes";
import { getBusNextDeparturesRoute } from "@/lib/api/routes/bus";
import { parseTodosQuery } from "@/lib/api/routes/todo-route-request";

async function expectInvalidQueryResponse(
  result: Response | Promise<Response>,
  message: string,
) {
  const response = await result;
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: message });
}

describe("API route query validation", () => {
  it("rejects oversized public pagination limits before clamping", async () => {
    await expectInvalidQueryResponse(
      getCoursesRoute(
        new Request("https://example.test/api/courses?limit=101"),
      ),
      "Invalid course query",
    );

    await expectInvalidQueryResponse(
      getSchedulesRoute(
        new Request("https://example.test/api/schedules?limit=101"),
      ),
      "Invalid schedule query",
    );
  });

  it("serializes next-bus and todo limit validation failures", async () => {
    await expectInvalidQueryResponse(
      getBusNextDeparturesRoute(
        new Request(
          "https://example.test/api/bus/next?originCampusId=1&destinationCampusId=2&limit=51",
        ),
      ),
      "Invalid bus next-departures query",
    );

    const todosQuery = parseTodosQuery(
      new Request("https://example.test/api/todos?limit=201"),
    );
    expect(todosQuery).toBeInstanceOf(Response);
    await expectInvalidQueryResponse(
      todosQuery as Response,
      "Invalid todo query",
    );
  });
});
