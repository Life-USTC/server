import { expect } from "@playwright/test";
import { type ProtocolFixture, test } from "./_fixture";
import { type Tokens, transports } from "./_transport";

test.use({
  features: [
    "workspace.todo",
    "workspace.upload",
    "community.comment",
    "community.section-homework",
  ],
});
const domains = {
  todo: {
    path: "/api/workspace/todos",
    field: "todoDelete",
    tool: "workspace_todo_delete",
    argument: "id",
  },
  upload: {
    path: "/api/workspace/uploads",
    field: "uploadDelete",
    tool: "workspace_upload_delete",
    argument: "id",
  },
  comment: {
    path: "/api/community/comments",
    field: "commentDelete",
    tool: "community_comment_delete",
    argument: "commentId",
  },
  homework: {
    path: "/api/community/section-homeworks",
    field: "homeworkDelete",
    tool: "community_section_homework_delete",
    argument: "homeworkId",
  },
} as const;
type Domain = keyof typeof domains;
async function rejectDelete(
  h: ProtocolFixture,
  domain: Domain,
  id: string,
  tokens: Tokens,
  meaning:
    | "not_found"
    | "forbidden"
    | "locked"
    | "suspended"
    | "storage_delete_failed",
  duringDelete?: (operation: () => Promise<Response>) => Promise<Response>,
) {
  const origin = h.origin;
  const binding = domains[domain];
  const requestDelete = (url: string | Request, init?: RequestInit) =>
    duringDelete ? duringDelete(() => fetch(url, init)) : fetch(url, init);
  const rest = await requestDelete(`${origin}${binding.path}/${id}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${tokens.rest}` },
  });
  expect(rest.status, await rest.clone().text()).toBe(
    meaning === "not_found"
      ? 404
      : meaning === "storage_delete_failed"
        ? 502
        : 403,
  );
  const restBody = await rest.json();
  const graph = await requestDelete(`${origin}/api/graphql`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokens.graphql}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query: `mutation($id: ID!) { ${binding.field}(id: $id) { success } }`,
      variables: { id },
    }),
  });
  expect(graph.status).toBe(
    meaning === "not_found"
      ? 404
      : meaning === "storage_delete_failed"
        ? 503
        : 403,
  );
  const graphBody = await graph.json();
  expect(graphBody.errors).toHaveLength(1);
  expect(graphBody.errors[0].extensions.code).toBe(
    meaning === "not_found"
      ? "NOT_FOUND"
      : meaning === "storage_delete_failed"
        ? "SERVICE_UNAVAILABLE"
        : "FORBIDDEN",
  );
  const mcp = await requestDelete(`${origin}/api/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokens.mcp}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: binding.tool,
        arguments: { [binding.argument]: id, mode: "full" },
      },
    }),
  });
  expect(mcp.status).toBe(200);
  const text = await mcp.text();
  const payload = mcp.headers.get("content-type")?.includes("text/event-stream")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .at(-1)
        ?.slice(6)
    : text;
  if (!payload) throw new Error("Missing MCP response");
  const envelope = JSON.parse(payload);
  expect(envelope.error).toBeUndefined();
  expect(envelope.result.isError, payload).not.toBe(true);
  const mcpBody = JSON.parse(
    envelope.result.content.find(
      (item: { type: string }) => item.type === "text",
    ).text,
  );
  expect(mcpBody).toMatchObject({ success: false, error: meaning });
  return {
    protocol: {
      rest_status: rest.status,
      graphql_status: graph.status,
      graphql_code: graphBody.errors[0].extensions.code,
    },
    rest: restBody,
    graphql: graphBody.errors.map(
      (error: { message: string; extensions: { code: string } }) => ({
        message: error.message,
        code: error.extensions.code,
      }),
    ),
    mcp: mcpBody,
  };
}

test("interface-hierarchy.private-delete-error-parity", async ({ h }) => {
  const db = h.db;
  const f = {
    owner: h.actors[0],
    other: h.actors[1],
    tokens: h.actors[0].tokens,
  };
  const todo = await db.todo.create({
    data: { userId: f.other.id, title: "foreign private todo" },
  });
  const upload = await db.upload.create({
    data: {
      userId: f.other.id,
      key: `errors/${crypto.randomUUID()}`,
      filename: "foreign-private.txt",
      size: 1,
    },
  });
  for (const [domain, row] of [
    ["todo", todo],
    ["upload", upload],
  ] as const) {
    const foreign = await rejectDelete(
      h,
      domain,
      row.id,
      f.tokens,
      "not_found",
    );
    const missing = await rejectDelete(
      h,
      domain,
      crypto.randomUUID(),
      f.tokens,
      "not_found",
    );
    expect(foreign).toEqual(missing);
    expect(JSON.stringify(foreign)).not.toContain(f.other.id);
  }
  expect(await db.todo.findUnique({ where: { id: todo.id } })).toEqual(todo);
  expect(await db.upload.findUnique({ where: { id: upload.id } })).toEqual(
    upload,
  );
});

test("interface-hierarchy.shared-delete-error-parity", async ({ h }) => {
  const db = h.db;
  const f = {
    owner: h.actors[0],
    other: h.actors[1],
    tokens: h.actors[0].tokens,
  };
  const section = h.section;
  const comment = await db.comment.create({
    data: {
      userId: f.other.id,
      sectionId: section.id,
      body: "public foreign comment",
    },
  });
  const locked = await db.comment.create({
    data: {
      userId: f.owner.id,
      sectionId: section.id,
      body: "locked owned comment",
      status: "deleted",
      deletedAt: new Date(),
    },
  });
  const homework = await db.homework.create({
    data: {
      createdById: f.other.id,
      sectionId: section.id,
      title: "public foreign homework",
    },
  });
  for (const [domain, row] of [
    ["comment", comment],
    ["homework", homework],
  ] as const) {
    await rejectDelete(h, domain, row.id, f.tokens, "forbidden");
    await rejectDelete(h, domain, crypto.randomUUID(), f.tokens, "not_found");
  }
  await rejectDelete(h, "comment", locked.id, f.tokens, "locked");
  expect(await db.comment.findUnique({ where: { id: comment.id } })).toEqual(
    comment,
  );
  expect(await db.comment.findUnique({ where: { id: locked.id } })).toEqual(
    locked,
  );
  expect(await db.homework.findUnique({ where: { id: homework.id } })).toEqual(
    homework,
  );
});

test("interface-hierarchy.suspended-delete-error-parity", async ({ h }) => {
  const db = h.db;
  const f = {
    owner: h.actors[0],
    other: h.actors[1],
    tokens: h.actors[0].tokens,
  };
  const section = h.section;
  const comment = await db.comment.create({
    data: {
      userId: f.owner.id,
      sectionId: section.id,
      body: "owned comment",
    },
  });
  const homework = await db.homework.create({
    data: {
      createdById: f.owner.id,
      sectionId: section.id,
      title: "owned homework",
    },
  });
  const upload = await db.upload.create({
    data: {
      userId: f.owner.id,
      key: `errors/${crypto.randomUUID()}`,
      filename: "owned.txt",
      size: 1,
    },
  });
  await db.userSuspension.create({
    data: { userId: f.owner.id, reason: "contract suspension" },
  });
  for (const [domain, row] of [
    ["comment", comment],
    ["homework", homework],
    ["upload", upload],
  ] as const)
    await rejectDelete(h, domain, row.id, f.tokens, "suspended");
  expect(await db.comment.findUnique({ where: { id: comment.id } })).toEqual(
    comment,
  );
  expect(await db.homework.findUnique({ where: { id: homework.id } })).toEqual(
    homework,
  );
  expect(await db.upload.findUnique({ where: { id: upload.id } })).toEqual(
    upload,
  );
});

async function successfulDelete(
  h: ProtocolFixture,
  domain: Domain,
  id: string,
  tokens: Tokens,
  surface: keyof Tokens,
  duringDelete?: (operation: () => Promise<Response>) => Promise<Response>,
) {
  const origin = h.origin;
  const binding = domains[domain];
  const requestDelete = (url: string | Request, init?: RequestInit) =>
    duringDelete ? duringDelete(() => fetch(url, init)) : fetch(url, init);
  if (surface === "rest") {
    const request = new Request(`${origin}${binding.path}/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${tokens.rest}` },
    });
    if (domain === "todo")
      expect(request.url + (await request.clone().text())).not.toMatch(
        /confirm/i,
      );
    const response = await requestDelete(request);
    expect(response.status, await response.clone().text()).toBe(200);
    const body = await response.json();
    if (domain === "upload")
      expect(body).toEqual({ deletedId: id, deletedSize: expect.any(Number) });
    else expect(body.success).toBe(true);
    return body;
  }
  const request = new Request(`${origin}/api/${surface}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokens[surface]}`,
      "content-type": "application/json",
      ...(surface === "mcp"
        ? { accept: "application/json, text/event-stream" }
        : {}),
    },
    body: JSON.stringify(
      surface === "graphql"
        ? {
            query: `mutation($id: ID!) { ${binding.field}(id: $id) { success ${domain === "homework" ? "alreadyDeleted" : ""} } }`,
            variables: { id },
          }
        : {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
              name: binding.tool,
              arguments: { [binding.argument]: id, mode: "full" },
            },
          },
    ),
  });
  if (domain === "todo")
    expect(request.url + (await request.clone().text())).not.toMatch(
      /confirm/i,
    );
  const response = await requestDelete(request);
  const text = await response.text();
  expect(response.status, text).toBe(200);
  const payload = response.headers
    .get("content-type")
    ?.includes("text/event-stream")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .at(-1)
        ?.slice(6)
    : text;
  if (!payload) throw new Error("Missing transport response");
  const envelope = JSON.parse(payload);
  expect(envelope.errors).toBeUndefined();
  expect(envelope.error).toBeUndefined();
  if (surface === "mcp")
    expect(envelope.result.isError, payload).not.toBe(true);
  const body =
    surface === "graphql"
      ? envelope.data[binding.field]
      : JSON.parse(
          envelope.result.content.find(
            (item: { type: string }) => item.type === "text",
          ).text,
        );
  expect(body.success).toBe(true);
  return body;
}

async function verifyDeleteReplay(
  h: ProtocolFixture,
  domain: "todo" | "comment" | "homework",
  surface: keyof Tokens,
) {
  const db = h.db;
  const f = {
    owner: h.actors[0],
    other: h.actors[1],
    tokens: h.actors[0].tokens,
  };
  const section = h.section;
  const row =
    domain === "todo"
      ? await db.todo.create({
          data: { userId: f.owner.id, title: `Replay ${surface}` },
        })
      : domain === "comment"
        ? await db.comment.create({
            data: {
              userId: f.owner.id,
              sectionId: section.id,
              body: `Replay ${surface}`,
            },
          })
        : await db.homework.create({
            data: {
              createdById: f.owner.id,
              sectionId: section.id,
              title: `Replay ${surface}`,
            },
          });
  const read = () =>
    domain === "todo"
      ? db.todo.findUnique({ where: { id: row.id } })
      : domain === "comment"
        ? db.comment.findUnique({ where: { id: row.id } })
        : db.homework.findUnique({ where: { id: row.id } });
  const first = await successfulDelete(h, domain, row.id, f.tokens, surface);
  const committed = await read();
  if (domain === "todo") expect(committed).toBeNull();
  else {
    expect(committed).toMatchObject({
      id: row.id,
      deletedAt: expect.any(Date),
      ...(domain === "comment"
        ? { status: "deleted" }
        : { deletedById: f.owner.id }),
    });
    expect(
      await db.auditLog.count({
        where: { action: `${domain}_delete`, targetId: row.id },
      }),
    ).toBe(1);
  }
  if (domain === "homework") {
    if (surface !== "rest") expect(first.alreadyDeleted).toBe(false);
    const replay = await successfulDelete(h, domain, row.id, f.tokens, surface);
    expect(replay.success).toBe(true);
    if (surface !== "rest") expect(replay.alreadyDeleted).toBe(true);
  } else {
    // Verify each protocol's native rejection without changing the committed row.
    await rejectDelete(
      h,
      domain,
      row.id,
      f.tokens,
      domain === "todo" ? "not_found" : "locked",
    );
  }
  expect(await read()).toEqual(committed);
  if (domain !== "todo")
    expect(
      await db.auditLog.count({
        where: { action: `${domain}_delete`, targetId: row.id },
      }),
    ).toBe(1);
}

for (const domain of ["todo", "comment", "homework"] as const)
  for (const surface of transports)
    test(`${domain} delete replay through ${surface} preserves the committed state`, async ({
      h,
    }) => verifyDeleteReplay(h, domain, surface));

for (const surface of transports) {
  test(`upload storage deletion failure and retry through ${surface}`, async ({
    h,
  }) => {
    const db = h.db;
    const owner = h.actors[0];
    const key = `uploads/${owner.id}/${crypto.randomUUID()}`;
    const content = `Owned bytes for ${surface}`;
    const storageUrl = `${h.origin}/__test/storage/uploads?key=${encodeURIComponent(key)}`;
    const storageHeaders = {
      "x-test-storage-secret": "local-test-storage-observer",
    };
    const probeUrl = `${storageUrl}&deleteProbe=1`;
    const metadataAtStorageDelete: number[] = [];
    async function probe(fail: boolean, hold: boolean) {
      const response = await fetch(probeUrl, {
        method: "POST",
        headers: { ...storageHeaders, "content-type": "application/json" },
        body: JSON.stringify({ fail, hold }),
      });
      expect(response.status).toBe(200);
    }
    async function readProbe() {
      const response = await fetch(probeUrl, { headers: storageHeaders });
      expect(response.status).toBe(200);
      return response.json();
    }
    try {
      const prepared = await fetch(storageUrl, {
        method: "PUT",
        headers: storageHeaders,
        body: content,
      });
      expect(prepared.status).toBe(204);
      const row = await db.upload.create({
        data: {
          userId: owner.id,
          key,
          filename: `${surface}.txt`,
          size: content.length,
        },
      });
      const auditCount = () =>
        db.auditLog.count({
          where: { action: "upload_delete", targetId: row.id },
        });
      // Hold the actual Worker's R2 deletion while independently observing DB and bytes.
      // This catches metadata deletion before storage succeeds, even if later rolled back.
      function observePending(fail: boolean) {
        return async (operation: () => Promise<Response>) => {
          await probe(fail, true);
          const pending = operation();
          void pending.catch(() => {});
          try {
            await expect
              .poll(readProbe)
              .toMatchObject({ pending: 1, hold: true, fail });
            metadataAtStorageDelete.push(
              await db.upload.count({ where: { key } }),
            );
            expect(
              await db.upload.findUnique({ where: { id: row.id } }),
            ).toEqual(row);
            expect(await auditCount()).toBe(0);
            const bytes = await fetch(storageUrl, { headers: storageHeaders });
            expect(bytes.status).toBe(200);
            expect(await bytes.text()).toBe(content);
          } finally {
            await probe(fail, false);
            await pending.catch(() => {});
          }
          return pending;
        };
      }
      const rejected = await rejectDelete(
        h,
        "upload",
        row.id,
        owner.tokens,
        "storage_delete_failed",
        observePending(true),
      );
      expect(JSON.stringify(rejected)).not.toContain("private-storage-failure");
      expect(await db.upload.findUnique({ where: { id: row.id } })).toEqual(
        row,
      );
      expect(
        await (await fetch(storageUrl, { headers: storageHeaders })).text(),
      ).toBe(content);
      expect(await auditCount()).toBe(0);
      expect(metadataAtStorageDelete).toEqual([1, 1, 1]);
      expect(await readProbe()).toMatchObject({ attempts: 3, pending: 0 });

      const deleted = await successfulDelete(
        h,
        "upload",
        row.id,
        owner.tokens,
        surface,
        observePending(false),
      );
      if (surface !== "graphql")
        expect(deleted.deletedSize).toBe(content.length);
      expect(
        (await fetch(storageUrl, { headers: storageHeaders })).status,
      ).toBe(404);
      expect(await db.upload.findUnique({ where: { id: row.id } })).toBeNull();
      expect(await auditCount()).toBe(1);
      expect(metadataAtStorageDelete).toEqual([1, 1, 1, 1]);
      expect(await readProbe()).toMatchObject({ attempts: 4, pending: 0 });
      await rejectDelete(h, "upload", row.id, owner.tokens, "not_found");
      expect(await readProbe()).toMatchObject({ attempts: 4, pending: 0 });
      expect(await auditCount()).toBe(1);
    } finally {
      // Releasing the exact-key probe first also handles assertion/setup failures.
      const reset = await fetch(probeUrl, {
        method: "DELETE",
        headers: storageHeaders,
      });
      expect(reset.status).toBe(204);
      const removed = await fetch(storageUrl, {
        method: "DELETE",
        headers: storageHeaders,
      });
      expect(removed.status).toBe(204);
    }
  });
}
