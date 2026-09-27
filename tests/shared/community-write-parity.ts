import { expect } from "vitest";
import {
  createWriteTransportHarness,
  type Operation,
  transports,
} from "./write-transport-harness";

async function withWriteParity(
  feature:
    | "community.comment"
    | "community.description"
    | "community.section-homework",
  run: (
    h: Awaited<ReturnType<typeof createWriteTransportHarness>>,
  ) => Promise<void>,
) {
  const harness = await createWriteTransportHarness([feature]);
  try {
    await run(harness);
  } finally {
    await harness.cleanup();
  }
}
function commentCreate(
  sectionJwId: number,
  body: string,
  parentId?: string,
): Operation {
  const input = {
    targetType: "section",
    sectionJwId,
    body,
    ...(parentId ? { parentId } : {}),
  };
  return {
    rest: { path: "/api/community/comments", method: "POST", body: input },
    graphql: {
      field: "commentCreate",
      query:
        "mutation($input: CreateCommentInput!) { commentCreate(input:$input) { id } }",
      variables: { input: { ...input, targetType: "SECTION" } },
    },
    mcp: { name: "community_comment_create", arguments: input },
  };
}
function commentUpdate(id: string, body: string): Operation {
  return {
    rest: {
      path: `/api/community/comments/${id}`,
      method: "PATCH",
      body: { body },
    },
    graphql: {
      field: "commentUpdate",
      query:
        "mutation($id: ID!, $input: UpdateCommentInput!) { commentUpdate(id:$id,input:$input) { id } }",
      variables: { id, input: { body } },
    },
    mcp: {
      name: "community_comment_update",
      arguments: { commentId: id, body },
    },
  };
}
function reaction(id: string, add: boolean): Operation {
  const field = add ? "commentReactionAdd" : "commentReactionRemove";
  return {
    rest: {
      path: `/api/community/comments/${id}/reactions${add ? "" : "?type=heart"}`,
      method: add ? "POST" : "DELETE",
      ...(add ? { body: { type: "heart" } } : {}),
    },
    graphql: {
      field,
      query: `mutation($id: ID!) { ${field}(commentId:$id,type:HEART) { active changed } }`,
      variables: { id },
    },
    mcp: {
      name: `community_comment_reaction_${add ? "add" : "remove"}`,
      arguments: { commentId: id, type: "heart" },
    },
  };
}
function descriptionSet(sectionJwId: number, content: string): Operation {
  const input = { targetType: "section", sectionJwId, content };
  return {
    rest: { path: "/api/community/descriptions", method: "POST", body: input },
    graphql: {
      field: "descriptionSet",
      query:
        "mutation($input: UpsertDescriptionInput!) { descriptionSet(input:$input) { id updated } }",
      variables: { input: { ...input, targetType: "SECTION" } },
    },
    mcp: { name: "community_description_set", arguments: input },
  };
}
function homeworkCreate(sectionJwId: number, title: string): Operation {
  const input = { sectionJwId, title };
  return {
    rest: {
      path: "/api/community/section-homeworks",
      method: "POST",
      body: input,
    },
    graphql: {
      field: "homeworkCreate",
      query:
        "mutation($input: CreateHomeworkInput!) { homeworkCreate(input:$input) { id } }",
      variables: { input },
    },
    mcp: { name: "community_section_homework_create", arguments: input },
  };
}
function homeworkUpdate(id: string, title: string): Operation {
  return {
    rest: {
      path: `/api/community/section-homeworks/${id}`,
      method: "PATCH",
      body: { title },
    },
    graphql: {
      field: "homeworkUpdate",
      query:
        "mutation($id: ID!, $input: UpdateHomeworkInput!) { homeworkUpdate(id:$id,input:$input) { id } }",
      variables: { id, input: { title } },
    },
    mcp: {
      name: "community_section_homework_update",
      arguments: { homeworkId: id, title },
    },
  };
}

export async function assertCommentWriteTransportAuthorization() {
  await withWriteParity("community.comment", async (h) => {
    const [owner] = h.actors;
    const rows = await Promise.all(
      h.actors.map((actor) =>
        h.db.comment.create({
          data: {
            sectionId: h.section.id,
            userId: actor.id,
            body: `Original ${actor.id}`,
          },
        }),
      ),
    );
    for (const transport of transports) {
      for (const [index, actor] of h.actors.entries()) {
        const own = rows[index];
        const foreign = rows[1 - index];
        const body = `Edited by ${actor.id} through ${transport}`;
        await h.call(transport, commentUpdate(own.id, body), actor);
        expect(
          await h.db.comment.findUnique({ where: { id: own.id } }),
        ).toMatchObject({ body, userId: actor.id });
        const created = await h.call(
          transport,
          commentCreate(h.section.jwId, body),
          actor,
        );
        expect(
          await h.db.comment.findUnique({ where: { id: created.id } }),
        ).toMatchObject({ body, userId: actor.id });
        const reply = await h.call(
          transport,
          commentCreate(h.section.jwId, body, foreign.id),
          actor,
        );
        expect(
          await h.db.comment.findUnique({ where: { id: reply.id } }),
        ).toMatchObject({ userId: actor.id, parentId: foreign.id });
        await h.call(transport, reaction(foreign.id, true), actor);
        expect(
          await h.db.commentReaction.findMany({
            where: { commentId: foreign.id, userId: actor.id },
          }),
        ).toHaveLength(1);
        await h.call(transport, reaction(foreign.id, false), actor);
        expect(
          await h.db.commentReaction.count({
            where: { commentId: foreign.id, userId: actor.id },
          }),
        ).toBe(0);
        const before = await h.snapshot();
        await h.call(
          transport,
          commentUpdate(foreign.id, "Rejected foreign edit"),
          actor,
          "forbidden",
        );
        expect(await h.snapshot()).toEqual(before);
      }
    }
    for (const transport of ["rest", "graphql"] as const) {
      const body = `Session edit ${transport}`;
      await h.call(
        transport,
        commentUpdate(rows[0].id, body),
        owner,
        "success",
        true,
      );
      expect(
        await h.db.comment.findUnique({ where: { id: rows[0].id } }),
      ).toMatchObject({ body, userId: owner.id });
    }
    for (const status of ["deleted", "softbanned"] as const) {
      const locked = await h.db.comment.create({
        data: {
          sectionId: h.section.id,
          userId: owner.id,
          body: "Locked original",
          status,
        },
      });
      const before = await h.snapshot();
      for (const transport of transports)
        for (const operation of [
          commentUpdate(locked.id, "Rejected lock edit"),
          commentCreate(h.section.jwId, "Rejected lock reply", locked.id),
          reaction(locked.id, true),
          reaction(locked.id, false),
        ])
          await h.call(transport, operation, owner, "locked");
      expect(await h.snapshot()).toEqual(before);
    }
    for (const transport of transports) {
      const before = await h.snapshot();
      await h.call(
        transport,
        commentUpdate(`${h.fixture.marker}-missing`, "Missing edit"),
        owner,
        "not_found",
      );
      await h.call(
        transport,
        commentCreate(
          h.section.jwId,
          "Missing parent",
          `${h.fixture.marker}-missing`,
        ),
        owner,
        "parent_not_found",
      );
      for (const outcome of ["anonymous", "read_scope"] as const)
        for (const operation of [
          commentCreate(h.section.jwId, "Rejected creation"),
          commentUpdate(rows[0].id, "Rejected edit"),
          commentCreate(h.section.jwId, "Rejected reply", rows[0].id),
          reaction(rows[0].id, true),
          reaction(rows[0].id, false),
        ])
          await h.call(transport, operation, owner, outcome);
      expect(await h.snapshot()).toEqual(before);
    }
    await h.db.userSuspension.create({
      data: { userId: owner.id, reason: h.fixture.marker },
    });
    const before = await h.snapshot();
    for (const transport of transports)
      for (const operation of [
        commentCreate(h.section.jwId, "Suspended create"),
        commentUpdate(rows[0].id, "Suspended edit"),
        commentCreate(h.section.jwId, "Suspended reply", rows[1].id),
        reaction(rows[1].id, true),
        reaction(rows[1].id, false),
      ])
        await h.call(transport, operation, owner, "suspended");
    expect(await h.snapshot()).toEqual(before);
    // Session callers reach the same current suspension gate, without OAuth scopes.
    await h.call(
      "rest",
      commentUpdate(rows[0].id, "Suspended session"),
      owner,
      "suspended",
      true,
    );
    await h.call(
      "graphql",
      commentUpdate(rows[0].id, "Suspended session"),
      owner,
      "suspended",
      true,
    );
    expect(await h.snapshot()).toEqual(before);
  });
}

export async function assertDescriptionWriteTransportAuthorization() {
  await withWriteParity("community.description", async (h) => {
    const [owner, other] = h.actors;
    let id: string | undefined;
    for (const transport of transports)
      for (const actor of h.actors) {
        const content = `Collaborative ${actor.id} ${transport}`;
        const result = await h.call(
          transport,
          descriptionSet(h.section.jwId, content),
          actor,
        );
        if (id) expect(result.id).toBe(id);
        else id = result.id;
        expect(
          await h.db.description.findUnique({ where: { id: result.id } }),
        ).toMatchObject({ content, lastEditedById: actor.id });
      }
    expect(
      await h.db.descriptionEdit.count({ where: { descriptionId: id } }),
    ).toBe(6);
    for (const transport of ["rest", "graphql"] as const) {
      const content = `Collaborative session ${transport}`;
      const result = await h.call(
        transport,
        descriptionSet(h.section.jwId, content),
        owner,
        "success",
        true,
      );
      expect(result.id).toBe(id);
      expect(
        await h.db.description.findUnique({ where: { id } }),
      ).toMatchObject({ content, lastEditedById: owner.id });
    }
    const before = await h.snapshot();
    for (const transport of transports) {
      await h.call(
        transport,
        descriptionSet(h.section.id, "Wrong identifier"),
        owner,
        "target_not_found",
      );
      for (const outcome of ["anonymous", "read_scope"] as const)
        await h.call(
          transport,
          descriptionSet(h.section.jwId, "Rejected editor"),
          owner,
          outcome,
        );
    }
    expect(await h.snapshot()).toEqual(before);
    await h.db.userSuspension.create({
      data: { userId: other.id, reason: h.fixture.marker },
    });
    for (const transport of transports)
      await h.call(
        transport,
        descriptionSet(h.section.jwId, "Suspended editor"),
        other,
        "suspended",
      );
    for (const transport of ["rest", "graphql"] as const)
      await h.call(
        transport,
        descriptionSet(h.section.jwId, "Suspended session"),
        other,
        "suspended",
        true,
      );
    expect(await h.snapshot()).toEqual(before);
  });
}

export async function assertHomeworkWriteTransportAuthorization() {
  await withWriteParity("community.section-homework", async (h) => {
    const [owner, other] = h.actors;
    const shared = await h.db.homework.create({
      data: {
        sectionId: h.section.id,
        createdById: owner.id,
        title: "Original shared homework",
      },
    });
    for (const transport of transports)
      for (const actor of h.actors) {
        const title = `Collaborative ${actor.id} ${transport}`;
        const created = await h.call(
          transport,
          homeworkCreate(h.section.jwId, title),
          actor,
        );
        expect(
          await h.db.homework.findUnique({ where: { id: created.id } }),
        ).toMatchObject({ title, createdById: actor.id });
        await h.call(transport, homeworkUpdate(shared.id, title), actor);
        expect(
          await h.db.homework.findUnique({ where: { id: shared.id } }),
        ).toMatchObject({
          title,
          createdById: owner.id,
          updatedById: actor.id,
        });
      }
    for (const transport of ["rest", "graphql"] as const) {
      const title = `Collaborative session ${transport}`;
      await h.call(
        transport,
        homeworkUpdate(shared.id, title),
        other,
        "success",
        true,
      );
      expect(
        await h.db.homework.findUnique({ where: { id: shared.id } }),
      ).toMatchObject({ title, createdById: owner.id, updatedById: other.id });
    }
    const deleted = await h.db.homework.create({
      data: {
        sectionId: h.section.id,
        createdById: owner.id,
        title: "Deleted assignment",
        deletedAt: new Date(),
        deletedById: owner.id,
      },
    });
    const before = await h.snapshot();
    for (const transport of transports) {
      await h.call(
        transport,
        homeworkUpdate(deleted.id, "Rejected restore"),
        owner,
        "deleted",
      );
      await h.call(
        transport,
        homeworkUpdate(`${h.fixture.marker}-missing`, "Missing assignment"),
        owner,
        "not_found",
      );
      await h.call(
        transport,
        homeworkCreate(h.section.id, "Wrong section identifier"),
        owner,
        "not_found",
      );
      for (const outcome of ["anonymous", "read_scope"] as const)
        for (const operation of [
          homeworkCreate(h.section.jwId, "Rejected creation"),
          homeworkUpdate(shared.id, "Rejected editor"),
        ])
          await h.call(transport, operation, owner, outcome);
    }
    expect(await h.snapshot()).toEqual(before);
    await h.db.userSuspension.create({
      data: { userId: other.id, reason: h.fixture.marker },
    });
    for (const transport of transports)
      for (const operation of [
        homeworkCreate(h.section.jwId, "Suspended creation"),
        homeworkUpdate(shared.id, "Suspended editor"),
      ])
        await h.call(transport, operation, other, "suspended");
    for (const transport of ["rest", "graphql"] as const)
      await h.call(
        transport,
        homeworkUpdate(shared.id, "Suspended session"),
        other,
        "suspended",
        true,
      );
    expect(await h.snapshot()).toEqual(before);
  });
}
