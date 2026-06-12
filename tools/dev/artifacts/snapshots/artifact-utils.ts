import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export type SnapshotKind = "pages" | "api" | "mcp";

export type SnapshotManifestEntry = {
  id?: unknown;
  error?: unknown;
};

export function resolveSnapshotRoot(kind: SnapshotKind) {
  return path.join(resolveSnapshotBase(), kind);
}

export function resolveSnapshotBase() {
  return path.join(process.cwd(), "test-results", "snapshots");
}

export function sanitizeFileSegment(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "_";
  return trimmed
    .replace(/%[0-9A-Fa-f]{2}/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "_");
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeTextFile(filePath: string, value: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value.endsWith("\n") ? value : `${value}\n`);
}

export async function resetDirectory(dirPath: string) {
  await fs.rm(dirPath, { recursive: true, force: true });
  await fs.mkdir(dirPath, { recursive: true });
}

export async function sha256File(filePath: string) {
  const bytes = await fs.readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

export function nowIso() {
  return new Date().toISOString();
}

export function relativeFromRoot(filePath: string) {
  return path.relative(process.cwd(), filePath).replaceAll(path.sep, "/");
}

export function assertNoSnapshotErrors(
  kind: SnapshotKind,
  entries: SnapshotManifestEntry[],
) {
  const failures = entries.filter((entry) => entry.error);
  if (failures.length === 0) return;

  const labels = failures
    .map((entry) => {
      const id = typeof entry.id === "string" ? entry.id : "unknown";
      const error =
        entry.error instanceof Error ? entry.error.message : entry.error;
      return `${id}: ${String(error)}`;
    })
    .join("\n");
  throw new Error(`${kind} snapshot capture failed:\n${labels}`);
}
