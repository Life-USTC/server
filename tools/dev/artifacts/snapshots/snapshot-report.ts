import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { diffLines } from "diff";
import { writeTextFile } from "./artifact-utils";

type DiffOptions = {
  baseline: string;
  candidate: string;
  output?: string;
  maxDiffLines: number;
};

function diffUsage() {
  return [
    "Usage:",
    "  bun run tools/dev/artifacts/snapshots/snapshot-report.ts diff <baseline-dir> <candidate-dir> [--output <file>] [--max-diff-lines <n>]",
    "",
    "Example:",
    "  bun run snapshot",
    "  git switch feature",
    "  bun run snapshot",
    "  bun run tools/dev/artifacts/snapshots/snapshot-report.ts diff test-results/260521120000-screenshot test-results/260521121000-screenshot-feature --output test-results/snapshot-diff.md",
  ].join("\n");
}

function parseDiffArgs(argv: string[]): DiffOptions {
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
      console.log(diffUsage());
      process.exit(0);
    } else {
      positionals.push(arg);
    }
  }

  if (positionals.length !== 2 || Number.isNaN(maxDiffLines)) {
    throw new Error(diffUsage());
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

async function diffSnapshots(argv: string[]) {
  const options = parseDiffArgs(argv);
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

type RenderOptions = {
  snapshotDir: string;
  artifactUrl: string;
  commit: string;
  output: string;
  screenshotBaseUrl?: string;
  status: string;
  workflowUrl?: string;
};

type SnapshotEntry = {
  id?: unknown;
  kind?: unknown;
  auth?: unknown;
  method?: unknown;
  path?: unknown;
  requestedPath?: unknown;
  pathTemplate?: unknown;
  finalUrl?: unknown;
  status?: unknown;
  expectedStatus?: unknown;
  ok?: unknown;
  screenshot?: unknown;
  response?: unknown;
  error?: unknown;
  durationMs?: unknown;
  title?: unknown;
};

type SnapshotManifest = {
  count?: unknown;
  entries?: unknown;
};

type RouteTreeNode = {
  label: string;
  entries: SnapshotEntry[];
  children: Map<string, RouteTreeNode>;
};

const MAX_EMBEDDED_JSON_CHARS = 600;
const SCREENSHOT_WIDTH = 480;
const IGNORED_PAGE_QUERY_PARAMS = new Set(["snapshotAt"]);

function renderUsage() {
  return [
    "Usage:",
    "  bun run tools/dev/artifacts/snapshots/snapshot-report.ts render-comment --snapshot-dir <dir> --artifact-url <url> --commit <sha> --status <status> --output <file> [--screenshot-base-url <url>] [--workflow-url <url>]",
  ].join("\n");
}

function readValue(argv: string[], index: number) {
  const value = argv[index + 1];
  if (!value) throw new Error(renderUsage());
  return value;
}

function parseRenderArgs(argv: string[]): RenderOptions {
  const options: Partial<RenderOptions> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--snapshot-dir") {
      options.snapshotDir = readValue(argv, index);
      index += 1;
    } else if (arg === "--artifact-url") {
      options.artifactUrl = readValue(argv, index);
      index += 1;
    } else if (arg === "--commit") {
      options.commit = readValue(argv, index);
      index += 1;
    } else if (arg === "--status") {
      options.status = readValue(argv, index);
      index += 1;
    } else if (arg === "--output") {
      options.output = readValue(argv, index);
      index += 1;
    } else if (arg === "--screenshot-base-url") {
      options.screenshotBaseUrl = readValue(argv, index);
      index += 1;
    } else if (arg === "--workflow-url") {
      options.workflowUrl = readValue(argv, index);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(renderUsage());
      process.exit(0);
    } else {
      throw new Error(renderUsage());
    }
  }

  if (
    !options.snapshotDir ||
    !options.artifactUrl ||
    !options.commit ||
    !options.status ||
    !options.output
  ) {
    throw new Error(renderUsage());
  }

  return {
    snapshotDir: path.resolve(options.snapshotDir),
    artifactUrl: options.artifactUrl,
    commit: options.commit,
    output: path.resolve(options.output),
    screenshotBaseUrl: options.screenshotBaseUrl?.replace(/\/$/, ""),
    status: options.status,
    workflowUrl: options.workflowUrl,
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asEntries(value: SnapshotManifest): SnapshotEntry[] {
  return Array.isArray(value.entries)
    ? value.entries.filter(
        (entry): entry is SnapshotEntry =>
          typeof entry === "object" && entry !== null,
      )
    : [];
}

async function readManifest(filePath: string): Promise<SnapshotManifest> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as SnapshotManifest;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function escapeCell(value: unknown) {
  const text =
    value === undefined || value === null || value === "" ? "-" : String(value);
  return text.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

function escapeHtml(value: unknown) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: unknown) {
  return escapeHtml(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function shortSha(sha: string) {
  return sha.slice(0, 12);
}

function resultCell(entry: SnapshotEntry) {
  if (entry.error) return `failed: ${escapeCell(entry.error)}`;
  if (entry.status !== undefined) {
    const expected = entry.status === entry.expectedStatus;
    if (expected) return `${escapeCell(entry.status)} expected`;
    return `${escapeCell(entry.status)} ${entry.ok === false ? "failed" : "ok"}`;
  }
  return "ok";
}

function entryFailed(entry: SnapshotEntry) {
  if (entry.error) return true;
  if (entry.ok !== false) return false;
  return entry.status !== entry.expectedStatus;
}

function linkToArtifact(label: string, artifactUrl: string, filePath?: string) {
  if (!filePath) return "-";
  return `<a href="${escapeAttribute(artifactUrl)}">${escapeHtml(label)}</a><br><sub>${escapeHtml(filePath)}</sub>`;
}

async function readSnapshotJson(
  snapshotDir: string,
  filePath: string | undefined,
) {
  if (!filePath) return undefined;
  const candidates = [
    path.resolve(filePath),
    path.join(snapshotDir, snapshotRelativePath(filePath)),
  ];
  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      ) {
        throw error;
      }
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function responsePreviewJson(entry: SnapshotEntry, json: string | undefined) {
  if (!json) return undefined;

  try {
    const snapshot = JSON.parse(json) as unknown;
    if (entry.kind === "api" && isRecord(snapshot)) {
      const response = snapshot.response;
      if (isRecord(response) && "body" in response) {
        return stableJson(response.body);
      }
    }

    if (entry.kind === "mcp" && isRecord(snapshot)) {
      if ("parsedText" in snapshot) return stableJson(snapshot.parsedText);
      if ("tools" in snapshot) return stableJson({ tools: snapshot.tools });
    }

    return stableJson(snapshot);
  } catch {
    return json;
  }
}

function snapshotRelativePath(filePath: string) {
  return filePath.replace(/^test-results\/[^/]+\//, "");
}

function encodeUrlPath(filePath: string) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

function screenshotCell(
  entry: SnapshotEntry,
  options: Pick<RenderOptions, "artifactUrl" | "screenshotBaseUrl">,
) {
  const filePath = asString(entry.screenshot);
  if (!filePath) return "-";

  if (!options.screenshotBaseUrl) {
    return linkToArtifact("screenshot.png", options.artifactUrl, filePath);
  }

  const screenshotUrl = `${options.screenshotBaseUrl}/${encodeUrlPath(snapshotRelativePath(filePath))}`;
  const label = escapeAttribute(entry.id ?? "screenshot");
  return `<a href="${screenshotUrl}"><img src="${screenshotUrl}" width="${SCREENSHOT_WIDTH}" alt="${label} screenshot"></a>`;
}

function finePrint(items: Array<[string, unknown]>) {
  const content = items
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .map(([label, value]) => `${label}: ${escapeHtml(value)}`)
    .join(" &middot; ");
  return content ? `<sub>${content}</sub>` : "";
}

function pageRoute(entry: SnapshotEntry) {
  const candidates = [entry.finalUrl, entry.requestedPath, entry.pathTemplate];
  for (const candidate of candidates) {
    const value = asString(candidate);
    if (!value) continue;
    try {
      const url = new URL(value, "http://snapshot.local");
      return `${url.pathname}${url.search}`;
    } catch {
      return value;
    }
  }
  return asString(entry.id) ?? "/";
}

function normalizedRoute(
  route: string,
  ignoredParams: Set<string> = new Set(),
) {
  try {
    const url = new URL(route, "http://snapshot.local");
    const params = [...url.searchParams.entries()].filter(
      ([key]) => !ignoredParams.has(key),
    );
    const search =
      params.length > 0
        ? `?${params.map(([key, value]) => `${key}=${value}`).join("&")}`
        : "";
    return `${url.pathname}${search}`;
  } catch {
    return route;
  }
}

function displayRoute(entry: SnapshotEntry) {
  if (entry.kind === "page") {
    return normalizedRoute(pageRoute(entry), IGNORED_PAGE_QUERY_PARAMS);
  }
  if (entry.kind === "mcp") return mcpRoute(entry);
  return normalizedRoute(entryRoute(entry));
}

function treeRoute(entry: SnapshotEntry) {
  if (entry.kind === "mcp") return "/mcp";
  return displayRoute(entry);
}

function entryRoute(entry: SnapshotEntry) {
  if (entry.kind === "page") return pageRoute(entry);
  if (entry.kind === "mcp") return mcpRoute(entry);

  const candidates = [entry.path, entry.requestedPath, entry.pathTemplate];
  for (const candidate of candidates) {
    const value = asString(candidate);
    if (!value) continue;
    try {
      const url = new URL(value, "http://snapshot.local");
      return `${url.pathname}${url.search}`;
    } catch {
      return value;
    }
  }

  return asString(entry.id) ?? "/";
}

function mcpRoute(entry: SnapshotEntry) {
  const id = asString(entry.id) ?? "response";
  return `/mcp/${encodeURIComponent(id)}`;
}

function routeSegments(route: string) {
  let url: URL;
  try {
    url = new URL(route, "http://snapshot.local");
  } catch {
    return [route || "/"];
  }

  const segments = url.pathname.split("/").filter(Boolean);

  const params = [...url.searchParams.entries()];
  if (params.length > 0) {
    segments.push(
      `?${params.map(([key, value]) => `${key}=${value}`).join("&")}`,
    );
  }

  return segments;
}

function compareRouteEntries(a: SnapshotEntry, b: SnapshotEntry) {
  const routeComparison = displayRoute(a).localeCompare(displayRoute(b), "en");
  if (routeComparison !== 0) return routeComparison;
  return String(a.id ?? "").localeCompare(String(b.id ?? ""), "en");
}

function createRouteTreeNode(label: string): RouteTreeNode {
  return { label, entries: [], children: new Map() };
}

function buildRouteTree(entries: SnapshotEntry[]) {
  const root = createRouteTreeNode("/");

  for (const entry of entries) {
    const segments = routeSegments(treeRoute(entry));
    let node = root;
    for (const segment of segments) {
      const existing = node.children.get(segment);
      if (existing) {
        node = existing;
        continue;
      }

      const child = createRouteTreeNode(segment);
      node.children.set(segment, child);
      node = child;
    }
    node.entries.push(entry);
  }

  return root;
}

async function renderRouteTreeNode(
  node: RouteTreeNode,
  renderEntry: (entry: SnapshotEntry) => Promise<string[]>,
  renderEntrySummary: (entry: SnapshotEntry) => string,
  depth = 0,
): Promise<string[]> {
  const lines: string[] = [];
  const entries = [...node.entries].sort(compareRouteEntries);
  const children = [...node.children.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "en"),
  );
  const combinedEntry = entries.length === 1 ? entries[0] : undefined;
  const nestedEntries = combinedEntry ? [] : entries;

  if (depth === 0) lines.push("<ul>");
  lines.push("<li>");
  lines.push(routeNodeSummary(node.label, combinedEntry, renderEntrySummary));
  if (combinedEntry) lines.push(...(await renderEntry(combinedEntry)));

  if (nestedEntries.length > 0 || children.length > 0) {
    lines.push("<ul>");
    for (const entry of nestedEntries) {
      lines.push("<li>");
      lines.push(entrySummary(entry, renderEntrySummary));
      lines.push(...(await renderEntry(entry)));
      lines.push("</li>");
    }
    for (const child of children) {
      lines.push(
        ...(await renderRouteTreeNode(
          child,
          renderEntry,
          renderEntrySummary,
          depth + 1,
        )),
      );
    }
    lines.push("</ul>");
  }

  lines.push("</li>");
  if (depth === 0) lines.push("</ul>");
  return lines;
}

function routeNodeSummary(
  label: string,
  entry: SnapshotEntry | undefined,
  renderEntrySummary: (entry: SnapshotEntry) => string,
) {
  const routeLabel = `<code>${escapeHtml(label)}</code>`;
  return entry ? `${routeLabel} ${renderEntrySummary(entry)}` : routeLabel;
}

function entrySummary(
  entry: SnapshotEntry,
  renderEntrySummary: (entry: SnapshotEntry) => string,
) {
  return renderEntrySummary(entry);
}

function previewJsonBlock(json: string | undefined) {
  if (!json) return ["<em>No response JSON captured.</em>"];
  const trimmed = json.trimEnd();
  const truncated =
    trimmed.length > MAX_EMBEDDED_JSON_CHARS
      ? `${trimmed.slice(0, MAX_EMBEDDED_JSON_CHARS)}\n... truncated ${trimmed.length - MAX_EMBEDDED_JSON_CHARS} chars ...`
      : trimmed;
  return [
    `<pre><code class="language-json">${escapeHtml(truncated)}</code></pre>`,
  ];
}

function markdownTableCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

function summaryTable(rows: Array<[string, string]>) {
  const lines = ["| Field | Value |", "| --- | --- |"];
  for (const [field, value] of rows) {
    lines.push(`| ${markdownTableCell(field)} | ${markdownTableCell(value)} |`);
  }
  return lines;
}

function screenshotPanel(
  entry: SnapshotEntry,
  options: Pick<RenderOptions, "artifactUrl" | "screenshotBaseUrl">,
) {
  const filePath = asString(entry.screenshot);
  if (!filePath) return "<em>No screenshot captured.</em>";
  return screenshotCell(entry, options);
}

function entryLabel(entry: SnapshotEntry, fallback: string) {
  return asString(entry.id) ?? fallback;
}

function pageMetadata(entry: SnapshotEntry) {
  return finePrint([
    ["result", resultCell(entry)],
    ["auth", entry.auth],
    ["title", entry.title],
    ["duration", entry.durationMs ? `${entry.durationMs}ms` : undefined],
  ]);
}

function screenshotTreeLines(
  entry: SnapshotEntry,
  options: Pick<RenderOptions, "artifactUrl" | "screenshotBaseUrl">,
) {
  const filePath = asString(entry.screenshot);
  const label = filePath ? path.basename(filePath) : "screenshot";

  return [
    "<ul>",
    "<li>",
    `<details><summary>${escapeHtml(label)}</summary>`,
    "",
    screenshotPanel(entry, options),
    "",
    "</details>",
    "</li>",
    "</ul>",
  ];
}

function pageSummary(entry: SnapshotEntry) {
  return `<strong>${escapeHtml(entryLabel(entry, "page"))}</strong> ${pageMetadata(entry)}`;
}

async function renderPageEntry(
  entry: SnapshotEntry,
  options: Pick<RenderOptions, "artifactUrl" | "screenshotBaseUrl">,
) {
  return screenshotTreeLines(entry, options);
}

function responseMetadata(entry: SnapshotEntry) {
  return finePrint([
    ["method", entry.kind === "api" ? entry.method : undefined],
    ["result", resultCell(entry)],
    ["auth", entry.auth],
    ["duration", entry.durationMs ? `${entry.durationMs}ms` : undefined],
  ]);
}

async function responseSnapshotTreeLines(
  entry: SnapshotEntry,
  options: Pick<RenderOptions, "snapshotDir">,
) {
  const responsePath = asString(entry.response);
  const json = await readSnapshotJson(options.snapshotDir, responsePath);
  const previewJson = responsePreviewJson(entry, json);
  const label = responsePath ? path.basename(responsePath) : "response.json";
  const artifact = responsePath
    ? ` <sub><code>${escapeHtml(snapshotRelativePath(responsePath))}</code></sub>`
    : "";
  return [
    "<ul>",
    "<li>",
    `<details><summary><code>${escapeHtml(label)}</code>${artifact}</summary>`,
    "",
    ...previewJsonBlock(previewJson),
    "",
    "</details>",
    "</li>",
    "</ul>",
  ];
}

function responseSummary(entry: SnapshotEntry) {
  return `<strong>${escapeHtml(entryLabel(entry, "response"))}</strong> ${responseMetadata(entry)}`;
}

async function renderResponseEntry(
  entry: SnapshotEntry,
  options: Pick<RenderOptions, "snapshotDir">,
) {
  return await responseSnapshotTreeLines(entry, options);
}

async function renderSnapshotComment(argv: string[]) {
  const options = parseRenderArgs(argv);
  const [pages, api, mcp] = await Promise.all([
    readManifest(path.join(options.snapshotDir, "pages", "manifest.json")),
    readManifest(path.join(options.snapshotDir, "api", "manifest.json")),
    readManifest(path.join(options.snapshotDir, "mcp", "manifest.json")),
  ]);

  const pageEntries = asEntries(pages);
  const apiEntries = asEntries(api);
  const mcpEntries = asEntries(mcp);
  const failedCount = [...pageEntries, ...apiEntries, ...mcpEntries].filter(
    entryFailed,
  ).length;
  const workflowValue = options.workflowUrl
    ? `[open](${options.workflowUrl})`
    : "-";
  const resultText =
    failedCount === 0
      ? "snapshot capture completed without failed entries."
      : `snapshot capture recorded ${failedCount} failed entries.`;
  const capturedText = [
    `${pageEntries.length} screenshots`,
    `${apiEntries.length} API responses`,
    `${mcpEntries.length} MCP responses`,
  ].join("<br>");
  const [pageTreeLines, apiTreeLines, mcpTreeLines] = await Promise.all([
    renderRouteTreeNode(
      buildRouteTree(pageEntries),
      async (entry) => renderPageEntry(entry, options),
      pageSummary,
    ),
    renderRouteTreeNode(
      buildRouteTree(apiEntries),
      async (entry) => renderResponseEntry(entry, options),
      responseSummary,
    ),
    renderRouteTreeNode(
      buildRouteTree(mcpEntries),
      async (entry) => renderResponseEntry(entry, options),
      responseSummary,
    ),
  ]);

  const lines = [
    "<!-- life-ustc-e2e-snapshot-artifacts -->",
    `## E2E snapshot artifacts for ${shortSha(options.commit)} (${options.status})`,
    "",
    ...summaryTable([
      ["Commit", `\`${options.commit}\``],
      ["Artifact", `[e2e-snapshot-artifacts](${options.artifactUrl})`],
      ["Workflow run", workflowValue],
      ["Result", resultText],
      ["Captured", capturedText],
    ]),
    "",
    "### Screenshots",
    "",
    ...(pageEntries.length > 0
      ? pageTreeLines
      : ["No page screenshots were generated."]),
    "",
    "### API Responses",
    "",
    ...(apiEntries.length > 0
      ? apiTreeLines
      : ["No API response snapshots were generated."]),
    "",
    "### MCP Responses",
    "",
    ...(mcpEntries.length > 0
      ? mcpTreeLines
      : ["No MCP response snapshots were generated."]),
  ];

  await writeTextFile(options.output, lines.join("\n"));
}

function reportUsage() {
  return [
    "Usage:",
    "  bun run tools/dev/artifacts/snapshots/snapshot-report.ts diff <baseline-dir> <candidate-dir> [--output <file>] [--max-diff-lines <n>]",
    "  bun run tools/dev/artifacts/snapshots/snapshot-report.ts render-comment --snapshot-dir <dir> --artifact-url <url> --commit <sha> --status <status> --output <file> [--screenshot-base-url <url>] [--workflow-url <url>]",
  ].join("\n");
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);

  if (mode === "diff") {
    await diffSnapshots(args);
    return;
  }
  if (mode === "render-comment") {
    await renderSnapshotComment(args);
    return;
  }
  throw new Error(reportUsage());
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
