import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { diffLines } from "diff";
import { writeTextFile } from "./artifact-utils";

type Options = {
  baseline: string;
  candidate: string;
  output?: string;
  maxDiffLines: number;
};

function usage() {
  return [
    "Usage:",
    "  bun run tools/dev/artifacts/snapshots/diff-snapshots.ts <baseline-dir> <candidate-dir> [--output <file>] [--max-diff-lines <n>]",
    "",
    "Example:",
    "  bun run snapshot",
    "  git switch feature",
    "  SNAPSHOT_REASON=feature bun run snapshot",
    "  bun run snapshot:diff test-results/260521120000-screenshot test-results/260521121000-screenshot-feature --output test-results/snapshot-diff.md",
  ].join("\n");
}

function parseArgs(argv: string[]): Options {
  const positionals: string[] = [];
  let output: string | undefined;
  let maxDiffLines = 120;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") {
      output = argv[index + 1];
      index += 1;
    } else if (arg === "--max-diff-lines") {
      maxDiffLines = Number.parseInt(argv[index + 1] ?? "", 10);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      positionals.push(arg);
    }
  }

  if (positionals.length !== 2 || Number.isNaN(maxDiffLines)) {
    throw new Error(usage());
  }

  return {
    baseline: path.resolve(positionals[0]),
    candidate: path.resolve(positionals[1]),
    output: output ? path.resolve(output) : undefined,
    maxDiffLines,
  };
}

async function collectFiles(root: string, dir = root): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(root, fullPath);
      if (!entry.isFile()) return [];
      return [path.relative(root, fullPath).replaceAll(path.sep, "/")];
    }),
  );
  return files.flat().sort();
}

function isTextFile(filePath: string) {
  return /\.(json|md|txt|ndjson|log|html|xml|ics)$/i.test(filePath);
}

function stripVolatileFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripVolatileFields);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "generatedAt" && key !== "durationMs")
      .map(([key, entry]) => [key, stripVolatileFields(entry)]),
  );
}

async function comparableText(filePath: string) {
  const text = await fs.readFile(filePath, "utf8");
  if (!filePath.endsWith(".json")) return text;

  return `${JSON.stringify(stripVolatileFields(JSON.parse(text)), null, 2)}\n`;
}

async function comparableSha256(filePath: string) {
  return createHash("sha256")
    .update(await comparableText(filePath))
    .digest("hex");
}

async function describeChangedText(
  baselinePath: string,
  candidatePath: string,
  maxDiffLines: number,
) {
  const [left, right] = await Promise.all([
    comparableText(baselinePath),
    comparableText(candidatePath),
  ]);
  const lines: string[] = [];
  for (const part of diffLines(left, right)) {
    const prefix = part.added ? "+" : part.removed ? "-" : " ";
    const partLines = part.value.split("\n");
    if (partLines.at(-1) === "") partLines.pop();
    for (const line of partLines) {
      if (part.added || part.removed) {
        lines.push(`${prefix}${line}`);
      }
      if (lines.length >= maxDiffLines) return lines;
    }
  }
  return lines;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [baselineFiles, candidateFiles] = await Promise.all([
    collectFiles(options.baseline),
    collectFiles(options.candidate),
  ]);
  const baselineSet = new Set(baselineFiles);
  const candidateSet = new Set(candidateFiles);
  const allFiles = Array.from(
    new Set([...baselineFiles, ...candidateFiles]),
  ).sort();

  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{
    file: string;
    baselineSha256: string;
    candidateSha256: string;
    diff?: string[];
  }> = [];

  for (const file of allFiles) {
    const baselinePath = path.join(options.baseline, file);
    const candidatePath = path.join(options.candidate, file);
    if (!baselineSet.has(file)) {
      added.push(file);
      continue;
    }
    if (!candidateSet.has(file)) {
      removed.push(file);
      continue;
    }

    const [baselineSha256, candidateSha256] = isTextFile(file)
      ? await Promise.all([
          comparableSha256(baselinePath),
          comparableSha256(candidatePath),
        ])
      : await Promise.all([
          fs
            .readFile(baselinePath)
            .then((bytes) => createHash("sha256").update(bytes).digest("hex")),
          fs
            .readFile(candidatePath)
            .then((bytes) => createHash("sha256").update(bytes).digest("hex")),
        ]);
    if (baselineSha256 === candidateSha256) continue;

    changed.push({
      file,
      baselineSha256,
      candidateSha256,
      diff: isTextFile(file)
        ? await describeChangedText(
            baselinePath,
            candidatePath,
            options.maxDiffLines,
          )
        : undefined,
    });
  }

  const lines = [
    "# E2E Snapshot Artifact Diff",
    "",
    `Baseline: \`${options.baseline}\``,
    `Candidate: \`${options.candidate}\``,
    "",
    `Added files: ${added.length}`,
    `Removed files: ${removed.length}`,
    `Changed files: ${changed.length}`,
    "",
  ];

  if (added.length > 0) {
    lines.push("## Added", "", ...added.map((file) => `- \`${file}\``), "");
  }
  if (removed.length > 0) {
    lines.push("## Removed", "", ...removed.map((file) => `- \`${file}\``), "");
  }
  if (changed.length > 0) {
    lines.push("## Changed", "");
    for (const item of changed) {
      lines.push(
        `### \`${item.file}\``,
        "",
        `- baseline: \`${item.baselineSha256}\``,
        `- candidate: \`${item.candidateSha256}\``,
      );
      if (item.diff && item.diff.length > 0) {
        lines.push("", "```diff", ...item.diff, "```");
      }
      lines.push("");
    }
  }

  const report = lines.join("\n");
  if (options.output) {
    await writeTextFile(options.output, report);
  }
  console.log(report);
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
