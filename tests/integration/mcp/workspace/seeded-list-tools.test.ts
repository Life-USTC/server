/**
 * MCP tools that were previously only exercised from Playwright's seeded-tools
 * list assertion (or only via E2E callTool). Call them through the in-process
 * harness so integration covers the same tool surface.
 */

import { describe, expect, it } from "vitest";
import {
  assertCommentRepliesPayload,
  assertCommentThreadFound,
} from "../../../shared/scenarios/comments";
import * as fixtures from "../_harness";

const context = fixtures.createMcpToolTestContext();
const subscribed = fixtures.createSubscribedIsolatedMcpToolTestContext({
  emailPrefix: "mcp-seeded-list-tools",
  name: "[integration-test] Seeded list tools",
});

describe("seeded-list MCP tools formerly E2E-only", () => {
  it("workspace_todo_list returns counts and incomplete seed todos", async () => {
    const result = await subscribed.client.call<{
      counts?: {
        incomplete?: number;
        completed?: number;
        overdue?: number;
      };
      todos?: Array<{ title?: string; completed?: boolean }>;
    }>("workspace_todo_list", {});

    expect(typeof result.counts?.incomplete).toBe("number");
    expect(typeof result.counts?.completed).toBe("number");
    expect(Array.isArray(result.todos)).toBe(true);
  });

  it("catalog_section_exam_list returns exams for the seed section", async () => {
    const result = await context.client.call<{
      found?: boolean;
      section?: { jwId?: number };
      exams?: Array<{ id?: number }>;
    }>("catalog_section_exam_list", {
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      locale: "zh-cn",
    });

    expect(result.found).toBe(true);
    expect(result.section?.jwId).toBe(fixtures.DEV_SEED.section.jwId);
    expect((result.exams?.length ?? 0) > 0).toBe(true);
  });

  it("catalog_bus_route_search returns paginated routes", async () => {
    const result = await context.client.call<{
      data?: Array<{ id?: string; name?: string }>;
      pagination?: { page?: number; pageSize?: number; total?: number };
    }>("catalog_bus_route_search", {
      limit: 5,
      locale: "zh-cn",
    });

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.pagination?.pageSize).toBe(5);
  });

  it("community_comment_replies returns replies for a seed root comment", async () => {
    const list = await context.client.call<{
      found?: boolean;
      data?: Array<{
        id?: string;
        body?: string;
        replies?: Array<{ id?: string }>;
      }>;
    }>("community_comment_list", {
      targetType: "section",
      sectionJwId: fixtures.DEV_SEED.section.jwId,
      mode: "full",
    });

    const root = assertCommentThreadFound(
      list,
      fixtures.DEV_SEED.comments.sectionRootBody,
    );

    const replies = await context.client.call<{
      found?: boolean;
      data?: Array<{ id?: string; body?: string; parentId?: string | null }>;
    }>("community_comment_replies", {
      commentId: root.id,
      mode: "full",
    });

    const rootId = root.id;
    expect(typeof rootId).toBe("string");
    if (!rootId) {
      throw new Error("expected seed comment root id");
    }
    assertCommentRepliesPayload(replies, rootId);
  });

  it("workspace_upload_list / workspace_homework_list / workspace_exam_list return arrays", async () => {
    const [uploads, homeworks, exams] = await Promise.all([
      subscribed.client.call<{
        uploads?: unknown[];
        usedBytes?: number;
      }>("workspace_upload_list", {}),
      subscribed.client.call<{
        homeworks?: unknown[];
      }>("workspace_homework_list", {
        completed: false,
        limit: 10,
        locale: "zh-cn",
      }),
      subscribed.client.call<{
        exams?: unknown[];
      }>("workspace_exam_list", {
        limit: 10,
        locale: "zh-cn",
      }),
    ]);

    expect(Array.isArray(uploads.uploads)).toBe(true);
    expect(Array.isArray(homeworks.homeworks)).toBe(true);
    expect(Array.isArray(exams.exams)).toBe(true);
  });
});
