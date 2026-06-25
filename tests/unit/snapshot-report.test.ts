import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

function renderSnapshotComment(options: {
  output: string;
  screenshotBaseUrl?: string;
  snapshotDir: string;
  status: string;
}) {
  const screenshotBaseUrlArgs =
    options.screenshotBaseUrl === undefined
      ? []
      : ["--screenshot-base-url", options.screenshotBaseUrl];

  execFileSync(
    "bun",
    [
      "run",
      "tools/dev/artifacts/snapshots/snapshot-report.ts",
      "render-comment",
      "--snapshot-dir",
      options.snapshotDir,
      "--artifact-url",
      "https://example.test/artifacts",
      "--commit",
      "0123456789abcdef0123456789abcdef01234567",
      "--status",
      options.status,
      ...screenshotBaseUrlArgs,
      "--output",
      options.output,
    ],
    { cwd: process.cwd(), stdio: "pipe" },
  );
}

describe("snapshot artifact report", () => {
  it("reports failed capture status even when manifests contain no failed entries", () => {
    const root = mkdtempSync(path.join(tmpdir(), "life-ustc-snapshot-report-"));
    try {
      const snapshotDir = path.join(root, "snapshots");
      const output = path.join(root, "comment.md");
      mkdirSync(path.join(snapshotDir, "pages"), { recursive: true });
      writeFileSync(
        path.join(snapshotDir, "pages", "manifest.json"),
        JSON.stringify({ entries: [] }),
      );

      renderSnapshotComment({
        output,
        snapshotDir,
        status: "failure",
      });

      const comment = readFileSync(output, "utf8");

      expect(comment).toContain(
        "snapshot capture failed before failed manifest entries were recorded.",
      );
      expect(comment).not.toContain(
        "snapshot capture completed without failed entries.",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("renders failed capture comments when screenshot previews were skipped", () => {
    const root = mkdtempSync(path.join(tmpdir(), "life-ustc-snapshot-report-"));
    try {
      const snapshotDir = path.join(root, "snapshots");
      const output = path.join(root, "comment.md");
      mkdirSync(path.join(snapshotDir, "pages"), { recursive: true });
      writeFileSync(
        path.join(snapshotDir, "pages", "manifest.json"),
        JSON.stringify({ entries: [] }),
      );

      renderSnapshotComment({
        output,
        screenshotBaseUrl: "",
        snapshotDir,
        status: "failure",
      });

      expect(readFileSync(output, "utf8")).toContain(
        "snapshot capture failed before failed manifest entries were recorded.",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
