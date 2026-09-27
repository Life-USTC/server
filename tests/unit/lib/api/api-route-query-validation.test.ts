import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseRouteQuery } from "@/lib/api/route-query-parsing";
import { getCoursesRoute } from "@/lib/api/routes/academic-course-routes";
import { getSchedulesRoute } from "@/lib/api/routes/academic-schedule-routes";
import { getBusNextDeparturesRoute } from "@/lib/api/routes/bus";
import { parseTodosQuery } from "@/lib/api/routes/todos";

async function expectInvalidQueryResponse(
  result: Response | Promise<Response>,
  message: string,
) {
  const response = await result;
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: message });
}

describe("API 路由查询校验", () => {
  it("openapi.pagination-query-parameter", () => {
    const schema = z.object({
      page: z.coerce.number().optional(),
      pageSize: z.coerce.number().optional(),
    });
    for (const [query, size] of [
      ["page=2&pageSize=7", 7],
      ["page=2&limit=7", 20],
      ["page=2&pageSize=9&limit=7", 9],
      ["page=2", 20],
    ] as const) {
      const parsed = parseRouteQuery(
        new URLSearchParams(query),
        schema,
        "Invalid query",
      );
      expect(parsed).not.toBeInstanceOf(Response);
      if (parsed instanceof Response)
        throw new Error("Valid canonical request was rejected");
      expect(parsed.pagination).toEqual({
        page: 2,
        pageSize: size,
        skip: size,
      });
      expect(parsed.query).not.toHaveProperty("limit");
    }
  });
  it("在查询前拒绝过大的 pageSize", async () => {
    await expectInvalidQueryResponse(
      getCoursesRoute(
        new Request("https://example.test/api/catalog/courses?pageSize=101"),
      ),
      "Invalid course query",
    );

    await expectInvalidQueryResponse(
      getSchedulesRoute(
        new Request("https://example.test/api/catalog/schedules?pageSize=101"),
      ),
      "Invalid schedule query",
    );
  });

  it("在查询前拒绝过大的公共目录页码与搜索字符串", async () => {
    await expectInvalidQueryResponse(
      getCoursesRoute(
        new Request("https://example.test/api/catalog/courses?page=101"),
      ),
      "Invalid course query",
    );
    await expectInvalidQueryResponse(
      getCoursesRoute(
        new Request(
          `https://example.test/api/catalog/courses?search=${"x".repeat(201)}`,
        ),
      ),
      "Invalid course query",
    );
  });

  it("序列化下一班车与待办事项限制校验失败", async () => {
    await expectInvalidQueryResponse(
      getBusNextDeparturesRoute(
        new Request(
          "https://example.test/api/catalog/bus/next?originCampusId=1&destinationCampusId=2&limit=51",
        ),
      ),
      "Invalid bus next-departures query",
    );

    const todosQuery = parseTodosQuery(
      new Request("https://example.test/api/workspace/todos?limit=201"),
    );
    expect(todosQuery).toBeInstanceOf(Response);
    await expectInvalidQueryResponse(
      todosQuery as Response,
      "Invalid todo query",
    );
  });

  it("待办查询在省略 limit 时使用有界默认值", () => {
    expect(
      parseTodosQuery(new Request("https://example.test/api/workspace/todos")),
    ).toMatchObject({ limit: 100 });
  });
});

it("preserves unknown query fields for a strict declared schema to reject", async () => {
  const schema = z.strictObject({ pageSize: z.string().optional() });
  for (const query of ["limit=1", "pageSize=2&limit=1"]) {
    const result = parseRouteQuery(
      new URLSearchParams(query),
      schema,
      "Invalid query",
    );
    expect(result).toBeInstanceOf(Response);
    await expectInvalidQueryResponse(result as Response, "Invalid query");
  }
  const accepted = parseRouteQuery(
    new URLSearchParams("pageSize=2"),
    schema,
    "Invalid query",
  );
  expect(accepted).not.toBeInstanceOf(Response);
});
