import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  commitCommentApiUrl,
  main,
  parseSnapshotCommentOptions,
  postCommitComment,
  snapshotPreviewBaseUrl,
  validateCommitSha,
  validateRepository,
} from "../../tools/dev/artifacts/snapshots/snapshot-ci";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const WORKFLOW_URL =
  "https://github.com/Life-USTC/server/actions/runs/123456789";

describe("snapshot CI input validation", () => {
  it("accepts only full hexadecimal commit SHAs", () => {
    expect(validateCommitSha(COMMIT.toUpperCase())).toBe(COMMIT);

    for (const value of [
      COMMIT.slice(0, 39),
      `${COMMIT}/screenshots`,
      "../0123456789abcdef0123456789abcdef01234567",
      "g".repeat(40),
    ]) {
      expect(() => validateCommitSha(value)).toThrow(
        "commit must be a 40-character hexadecimal SHA",
      );
    }
  });

  it("accepts only safe owner/repo repository names", () => {
    expect(validateRepository("Life-USTC/server")).toBe("Life-USTC/server");
    expect(validateRepository("owner.name/repo_name-1")).toBe(
      "owner.name/repo_name-1",
    );

    for (const value of [
      "Life-USTC/server/extra",
      "../server",
      "Life USTC/server",
      "Life-USTC/..",
      "/server",
      "owner/",
    ]) {
      expect(() => validateRepository(value)).toThrow(
        "repository must be owner/repo using only safe GitHub name characters",
      );
    }
  });

  it("validates preview and commit-comment URLs before construction", () => {
    expect(
      snapshotPreviewBaseUrl("Life-USTC/server", COMMIT.toUpperCase()),
    ).toBe(
      `https://raw.githubusercontent.com/Life-USTC/server/e2e-snapshot-artifacts/${COMMIT}`,
    );
    expect(commitCommentApiUrl("Life-USTC/server", COMMIT)).toBe(
      `https://api.github.com/repos/Life-USTC/server/commits/${COMMIT}/comments`,
    );

    expect(() => snapshotPreviewBaseUrl("../server", COMMIT)).toThrow(
      "repository must be owner/repo using only safe GitHub name characters",
    );
    expect(() => commitCommentApiUrl("Life-USTC/server", "not-a-sha")).toThrow(
      "commit must be a 40-character hexadecimal SHA",
    );
  });
});

describe("snapshot CI comment command", () => {
  it("falls back to the workflow URL when no artifact URL is available", () => {
    const options = parseSnapshotCommentOptions([
      "--commit",
      COMMIT,
      "--status",
      "failure",
      "--artifact-url",
      "",
      "--workflow-url",
      WORKFLOW_URL,
    ]);

    expect(options.post).toBe(false);
    expect(options.render.artifactUrl).toBe(WORKFLOW_URL);
    expect(options.render.workflowUrl).toBe(WORKFLOW_URL);
  });

  it("renders a commit comment without posting unless --post is set", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "life-ustc-snapshot-ci-"));
    try {
      const output = path.join(root, "comment.md");

      await main([
        "comment",
        "--snapshot-dir",
        path.join(root, "missing-snapshots"),
        "--artifact-url",
        "",
        "--workflow-url",
        WORKFLOW_URL,
        "--commit",
        COMMIT,
        "--status",
        "failure",
        "--output",
        output,
      ]);

      const comment = readFileSync(output, "utf8");

      expect(comment).toContain(
        `E2E snapshot artifacts for ${COMMIT.slice(0, 12)}`,
      );
      expect(comment).toContain(`[e2e-snapshot-artifacts](${WORKFLOW_URL})`);
      expect(comment).toContain(
        "snapshot capture failed before failed manifest entries were recorded.",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("posts rendered comments through the GitHub commit comments API", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 201,
      statusText: "Created",
      text: async () => "",
    })) as unknown as typeof fetch;

    await expect(
      postCommitComment({
        apiUrl: "https://api.github.test",
        body: "Snapshot comment",
        commit: COMMIT,
        fetchImpl,
        repository: "Life-USTC/server",
        token: "ghs_test",
      }),
    ).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0];

    expect(url).toBe(
      `https://api.github.test/repos/Life-USTC/server/commits/${COMMIT}/comments`,
    );
    expect(init).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        authorization: "Bearer ghs_test",
        "content-type": "application/json",
      }),
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      body: "Snapshot comment",
    });
  });
});
