import { expect } from "@playwright/test";
import { test } from "../../../e2e/utils/owned-worker";
import { createCatalogContractFixture } from "../../../shared/catalog-contract-fixture";
import { createParityTokenSigner } from "./_parity-auth";
import { nativeEnvelope } from "./_transport";

const kinds = ["todo", "homework", "schedule", "exam"] as const;
type Kind = (typeof kinds)[number];
type Filter = Record<string, string | number | boolean>;
type Id = string | number;
type Row = { id: Id; completed?: boolean; completion?: unknown };
type Tokens = { rest: string; graphql: string; mcp: string };
const paths = {
  todo: "todos",
  homework: "homeworks",
  schedule: "schedules",
  exam: "exams",
};
const ids = (rows: Row[]) => rows.map((row) => row.id);
function createWorkspaceReaders(origin: string) {
  async function json(response: Response) {
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    return body;
  }
  async function rest(kind: Kind, token: string, filter: Filter) {
    const params = new URLSearchParams(
      Object.entries(filter).map(([key, value]) => [key, String(value)]),
    );
    return json(
      await fetch(`${origin}/api/workspace/${paths[kind]}?${params}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
  }
  async function graph(
    kind: Kind,
    token: string,
    filter: Filter,
    page: number,
    pageSize: number,
  ) {
    const type = `${kind[0].toUpperCase()}${kind.slice(1)}Filter`;
    const body = await json(
      await fetch(`${origin}/api/graphql`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          query: `query Parity($filter: ${type}, $page: PageInput) { workspace { ${paths[kind]}(filter: $filter, page: $page) { items { id ${kind === "homework" ? "completed" : ""} } pageInfo { page pageSize total totalPages } } } }`,
          variables: {
            filter: {
              ...filter,
              ...(filter.priority
                ? { priority: String(filter.priority).toUpperCase() }
                : {}),
            },
            page: { page, pageSize },
          },
        }),
      }),
    );
    expect(body.errors).toBeUndefined();
    return body.data.workspace[paths[kind]];
  }
  async function mcp(kind: Kind, token: string, args: Filter) {
    const response = await fetch(`${origin}/api/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: `workspace_${kind}_list`,
          arguments: { ...args, mode: "full" },
        },
      }),
    });
    const body = await nativeEnvelope(response);
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.error).toBeUndefined();
    expect(body.result.isError, JSON.stringify(body)).not.toBe(true);
    return JSON.parse(
      body.result.content.find((part: { type: string }) => part.type === "text")
        .text,
    );
  }
  async function compare(
    kind: Kind,
    tokens: Tokens,
    filter: Filter,
    expected: Id[],
    options: { rest?: boolean; mcp?: boolean; completedIds?: string[] } = {},
  ) {
    const pageSize = 2;
    const pagedRest = kind === "homework" || kind === "exam";
    const useRest = options.rest !== false;
    const useMcp = options.mcp !== false;
    const pages = Math.max(1, Math.ceil(expected.length / pageSize));
    const graphRows: Row[] = [];
    for (let page = 1; page <= pages + 1; page++) {
      const result = await graph(kind, tokens.graphql, filter, page, pageSize);
      const expectedPage = expected.slice(
        (page - 1) * pageSize,
        page * pageSize,
      );
      expect(
        ids(result.items),
        `${kind} GraphQL page ${page} ${JSON.stringify(filter)}`,
      ).toEqual(expectedPage);
      expect(result.pageInfo).toEqual({
        page,
        pageSize,
        total: expected.length,
        totalPages: pages,
      });
      graphRows.push(...result.items);
      if (useRest && pagedRest) {
        const resultRest = await rest(kind, tokens.rest, {
          ...filter,
          page,
          pageSize,
        });
        expect(ids(resultRest.data)).toEqual(expectedPage);
        expect(resultRest.pagination).toEqual(result.pageInfo);
        if (options.completedIds)
          expect(
            resultRest.data
              .filter((row: Row) => Boolean(row.completion))
              .map((row: Row) => row.id),
          ).toEqual(
            expectedPage.filter((id) =>
              options.completedIds?.includes(String(id)),
            ),
          );
      }
    }
    expect(ids(graphRows)).toEqual(expected);
    if (options.completedIds)
      expect(
        graphRows.filter((row) => row.completed).map((row) => row.id),
      ).toEqual(
        expected.filter((id) => options.completedIds?.includes(String(id))),
      );
    for (const limit of [2, 100]) {
      const expectedPrefix = expected.slice(0, limit);
      const resultRest =
        useRest && !pagedRest
          ? await rest(kind, tokens.rest, { ...filter, limit })
          : undefined;
      if (resultRest)
        expect(ids(resultRest[paths[kind]])).toEqual(expectedPrefix);
      if (useMcp) {
        const mcpFilter =
          kind === "todo"
            ? { includeCompleted: filter.completed !== false }
            : filter;
        const resultMcp = await mcp(kind, tokens.mcp, { ...mcpFilter, limit });
        expect(
          ids(resultMcp[paths[kind]]),
          `${kind} MCP ${JSON.stringify(filter)}`,
        ).toEqual(expectedPrefix);
        expect(resultMcp.pagination).toBeUndefined();
        if (resultRest && kind === "todo")
          expect(resultMcp.counts).toEqual(resultRest.counts);
        if (options.completedIds)
          expect(
            resultMcp[paths[kind]]
              .filter((row: Row) => Boolean(row.completion))
              .map((row: Row) => row.id),
          ).toEqual(
            expectedPrefix.filter((id) =>
              options.completedIds?.includes(String(id)),
            ),
          );
      }
    }
  }
  return { compare };
}

// Prepared-state read consumers; mutation side effects require separate observations.
test("interface-hierarchy.workspace-explicit-read-parity", async ({
  isolatedWorker,
  run,
}) =>
  run(async () => {
    const db = isolatedWorker.database.owner;
    const origin = isolatedWorker.origin;
    const { compare } = createWorkspaceReaders(origin);
    const signToken = await createParityTokenSigner(isolatedWorker);
    const fixture = await createCatalogContractFixture(db);
    const userIds = [0, 1, 2].map(
      (index) => `workspace-parity-${fixture.marker}-${index}`,
    );
    const clientId = `workspace-parity-client-${fixture.marker}`;
    await db.user.createMany({
      data: userIds.map((id) => ({ id, email: `${id}@example.test` })),
    });
    const scopes = kinds.map((kind) => `workspace.${kind}:read`);
    const client = await db.oAuthClient.create({
      data: {
        clientId,
        name: "Workspace parity",
        redirectUris: ["https://example.test/callback"],
        consents: { create: userIds.map((userId) => ({ userId, scopes })) },
      },
      include: { consents: true },
    });
    const credentials: Tokens[] = [];
    for (const userId of userIds) {
      const grantId = client.consents.find(
        (consent) => consent.userId === userId,
      )?.grantId;
      if (!grantId) throw new Error("Missing fixture consent grant");
      const tokens = {} as Tokens;
      for (const [transport, resource] of Object.entries({
        rest: `${origin}/api/auth`,
        graphql: `${origin}/api/graphql`,
        mcp: `${origin}/api/mcp`,
      })) {
        const issuedAt = Math.floor(Date.now() / 1000);
        const token = await signToken({
          clientId,
          grantId,
          userId,
          scopes,
          resource,
          issuedAt,
          expiresAt: issuedAt + 600,
        });
        if (!token) throw new Error("Missing signed access token");
        tokens[transport as keyof Tokens] = token;
      }
      credentials.push(tokens);
    }
    const newer = await db.semester.create({
      data: {
        jwId: fixture.base + 1,
        code: `${fixture.marker}-newer`,
        nameCn: "2030春",
      },
    });
    await db.section.update({
      where: { id: fixture.sections[1].id },
      data: { semesterId: newer.id },
    });
    const otherSection = await db.section.create({
      data: {
        jwId: fixture.base + 2,
        code: `${fixture.marker}-other`,
        courseId: fixture.courses[0].id,
        semesterId: newer.id,
      },
    });
    const sections = [...fixture.sections, otherSection];
    await db.userSectionSubscription.createMany({
      data: [
        { userId: userIds[0], sectionId: sections[0].id },
        { userId: userIds[0], sectionId: sections[1].id },
        { userId: userIds[1], sectionId: sections[0].id },
        { userId: userIds[1], sectionId: sections[2].id },
      ],
    });
    const schedules: Id[][] = [],
      exams: Id[][] = [],
      homeworks: string[][] = [];
    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      const sectionId = sections[sectionIndex].id;
      const group = await db.scheduleGroup.create({
        data: {
          jwId: fixture.base + sectionIndex,
          sectionId,
          no: 1,
          limitCount: 10,
          stdCount: 0,
          actualPeriods: 2,
          isDefault: true,
        },
      });
      schedules.push([]);
      exams.push([]);
      homeworks.push([]);
      // Reverse insertion order ensures assertions exercise declared date/time ordering.
      for (const day of [2, 1]) {
        const schedule = await db.schedule.create({
          data: {
            sectionId,
            scheduleGroupId: group.id,
            date: new Date(`2030-01-0${day}T00:00:00Z`),
            weekday: day + 1,
            startTime: 800 + sectionIndex * 100,
            endTime: 850 + sectionIndex * 100,
            periods: 1,
            weekIndex: 1,
            startUnit: 1,
            endUnit: 1,
          },
        });
        schedules[sectionIndex].unshift(schedule.id);
        const homework = await db.homework.create({
          data: {
            sectionId,
            title: `${fixture.marker}-${sectionIndex}-${day}`,
            submissionDueAt: new Date(
              `2030-01-0${day}T0${sectionIndex + 1}:00:00Z`,
            ),
          },
        });
        homeworks[sectionIndex].unshift(homework.id);
      }
      const exam = await db.exam.create({
        data: {
          jwId: fixture.base + sectionIndex,
          sectionId,
          examDate: new Date("2030-01-01T00:00:00Z"),
          startTime: 800 + sectionIndex * 100,
          endTime: 900 + sectionIndex * 100,
        },
      });
      exams[sectionIndex].push(exam.id);
    }
    const unknown = await db.exam.create({
      data: {
        jwId: fixture.base + 3,
        sectionId: sections[0].id,
        examDate: null,
      },
    });
    await db.homeworkCompletion.createMany({
      data: [
        { userId: userIds[0], homeworkId: homeworks[0][0] },
        { userId: userIds[1], homeworkId: homeworks[0][1] },
      ],
    });
    const todos: string[][] = [];
    for (const userId of userIds.slice(0, 2)) {
      const rows = [];
      for (const [suffix, dueAt, completed, priority] of [
        ["completed", "2030-01-01T00:00:00Z", true, "low"],
        ["undated", null, false, "medium"],
        ["later", "2030-01-02T00:00:00Z", false, "low"],
        ["earlier", "2030-01-01T00:00:00Z", false, "high"],
      ] as const)
        rows.push(
          await db.todo.create({
            data: {
              userId,
              title: `${fixture.marker}-${suffix}`,
              dueAt: dueAt ? new Date(dueAt) : null,
              completed,
              priority,
            },
          }),
        );
      todos.push([rows[3].id, rows[2].id, rows[1].id, rows[0].id]);
    }
    for (let owner = 0; owner < 2; owner++) {
      const token = credentials[owner];
      const distinct = owner + 1;
      const homeworkIds = [
        homeworks[0][0],
        homeworks[distinct][0],
        homeworks[0][1],
        homeworks[distinct][1],
      ];
      const completedIds = [homeworks[0][owner]];
      const scheduleIds = [
        schedules[0][0],
        schedules[distinct][0],
        schedules[0][1],
        schedules[distinct][1],
      ];
      await compare("todo", token, {}, todos[owner]);
      await compare(
        "todo",
        token,
        { completed: false },
        todos[owner].slice(0, 3),
      );
      await compare("todo", token, { completed: true }, todos[owner].slice(3), {
        mcp: false,
      });
      await compare(
        "todo",
        token,
        {
          priority: "high",
          dueAfter: "2030-01-01T00:00:00Z",
          dueBefore: "2030-01-02T00:00:00Z",
        },
        todos[owner].slice(0, 1),
        { mcp: false },
      );
      await compare("homework", token, {}, homeworkIds, { completedIds });
      await compare("homework", token, { completed: true }, completedIds, {
        rest: false,
        completedIds,
      });
      await compare(
        "homework",
        token,
        { completed: false },
        homeworkIds.filter((id) => !completedIds.includes(id)),
        { rest: false, completedIds },
      );
      await compare(
        "homework",
        token,
        { semesterId: newer.id },
        homeworks[distinct],
        { rest: false, completedIds },
      );
      await compare("schedule", token, {}, scheduleIds);
      await compare(
        "schedule",
        token,
        {
          dateFrom: "2030-01-01T00:00:00Z",
          dateTo: "2030-01-01T00:00:00Z",
          weekday: 2,
        },
        scheduleIds.slice(0, 2),
      );
      await compare(
        "schedule",
        token,
        { semesterId: newer.id },
        schedules[distinct],
        { rest: false },
      );
      await compare("exam", token, { includeDateUnknown: true }, [
        exams[0][0],
        exams[distinct][0],
        unknown.id,
      ]);
      await compare(
        "exam",
        token,
        {
          dateFrom: "2030-01-01T00:00:00Z",
          dateTo: "2030-01-01T00:00:00Z",
          includeDateUnknown: false,
        },
        [exams[0][0], exams[distinct][0]],
      );
      await compare(
        "exam",
        token,
        { semesterId: newer.id, includeDateUnknown: true },
        exams[distinct],
      );
      await compare(
        "exam",
        token,
        {
          dateFrom: "2030-01-02T00:00:00Z",
          dateTo: "2030-01-02T00:00:00Z",
          includeDateUnknown: true,
        },
        [unknown.id],
      );
      await compare(
        "exam",
        token,
        {
          dateFrom: "2030-01-02T00:00:00Z",
          dateTo: "2030-01-02T00:00:00Z",
          includeDateUnknown: false,
        },
        [],
      );
    }
    for (const kind of kinds) await compare(kind, credentials[2], {}, []);
    await db.userSectionSubscription.create({
      data: { userId: userIds[2], sectionId: sections[0].id },
    });
    const sectionId = sections[0].id;
    const group = await db.scheduleGroup.findFirstOrThrow({
      where: { sectionId },
    });
    await db.homework.deleteMany({ where: { sectionId } });
    await db.schedule.deleteMany({ where: { sectionId } });
    await db.exam.deleteMany({ where: { sectionId } });
    const tied = {
      todo: [] as Id[],
      homework: [] as Id[],
      schedule: [] as Id[],
      exam: [] as Id[],
    };
    const at = new Date("2030-01-01T00:00:00Z");
    for (const offset of [15, 14, 13, 12, 11, 10]) {
      const id = `${fixture.marker}-tie-${offset}`;
      const todo = await db.todo.create({
        data: { id, title: id, userId: userIds[2], dueAt: at, createdAt: at },
      });
      const homework = await db.homework.create({
        data: { id, title: id, sectionId, submissionDueAt: at, createdAt: at },
      });
      const schedule = await db.schedule.create({
        data: {
          id: fixture.base + offset,
          sectionId,
          scheduleGroupId: group.id,
          date: at,
          weekday: 2,
          startTime: 800,
          endTime: 900,
          periods: 1,
          weekIndex: 1,
          startUnit: 1,
          endUnit: 1,
        },
      });
      const exam = await db.exam.create({
        data: {
          jwId: fixture.base + offset,
          sectionId,
          examDate: at,
          startTime: 800,
          endTime: 900,
        },
      });
      tied.todo.unshift(todo.id);
      tied.homework.unshift(homework.id);
      tied.schedule.unshift(schedule.id);
      tied.exam.unshift(exam.id);
    }
    for (const kind of kinds)
      await compare(kind, credentials[2], {}, tied[kind]);
  }));
