import "dotenv/config";

import { readdirSync } from "node:fs";
import { join } from "node:path";

export const repoRoot = process.cwd();

export function walkFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath);
    }
    if (entry.isFile()) {
      return [fullPath];
    }
    return [];
  });
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export function reportUnexpectedError(error: unknown): never {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exit(1);
}
