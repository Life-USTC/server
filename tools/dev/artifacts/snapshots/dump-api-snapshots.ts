import * as path from "node:path";
import { type APIRequestContext, chromium } from "@playwright/test";
import {
  assertNoSnapshotErrors,
  nowIso,
  relativeFromRoot,
  resetDirectory,
  resolveSnapshotRoot,
  sanitizeFileSegment,
  sha256File,
  writeJsonFile,
  writeTextFile,
} from "./artifact-utils";
import { createAuthedPage } from "./auth";
import {
  API_SNAPSHOT_CASES,
  type ApiSnapshotCase,
  type SnapshotAuth,
} from "./snapshot-cases";

async function requestForAuth(
  requests: Map<SnapshotAuth, APIRequestContext>,
  auth: SnapshotAuth,
) {
  const request = requests.get(auth);
  if (!request) throw new Error(`Missing request context for ${auth}`);
  return request;
}

async function resolvePath(
  request: APIRequestContext,
  snapshotCase: ApiSnapshotCase,
) {
  if (!snapshotCase.resolvePath) return snapshotCase.path;

  const response = await request.post("/api/sections/match-codes", {
    data: { codes: [snapshotCase.resolvePath.sectionCode] },
  });
  const body = (await response.json()) as {
    sections?: Array<{ id?: number; code?: string | null }>;
  };
  const sectionId = body.sections?.find(
    (section) => section.code === snapshotCase.resolvePath?.sectionCode,
  )?.id;
  if (!sectionId) throw new Error("Unable to resolve seed section id");

  return snapshotCase.resolvePath.target.replace(
    "__section_id__",
    `${sectionId}`,
  );
}

function stableResponseHeaders(headers: Record<string, string>) {
  const volatileHeaders = new Set([
    "date",
    "etag",
    "x-matched-path",
    "x-middleware-rewrite",
    "x-nextjs-cache",
    "x-powered-by",
    "x-request-id",
    "x-vercel-cache",
    "x-vercel-id",
  ]);
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([key]) => !volatileHeaders.has(key.toLowerCase()))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

async function main() {
  const baseUrl =
    process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3000";
  const root = resolveSnapshotRoot("api");
  const browser = await chromium.launch();
  const contexts = new Map<
    SnapshotAuth,
    Awaited<ReturnType<typeof browser.newContext>>
  >();
  const requests = new Map<SnapshotAuth, APIRequestContext>();
  const entries: Array<Record<string, unknown>> = [];
  await resetDirectory(root);

  try {
    for (const auth of ["public", "debug", "admin"] as const) {
      const context = await browser.newContext({ baseURL: baseUrl });
      contexts.set(auth, context);
      if (auth !== "public") {
        const page = await createAuthedPage(context, auth);
        await page.close();
      }
      requests.set(auth, context.request);
    }

    for (const snapshotCase of API_SNAPSHOT_CASES) {
      const startedAt = performance.now();
      const dir = path.join(root, sanitizeFileSegment(snapshotCase.id));
      await resetDirectory(dir);
      const request = await requestForAuth(requests, snapshotCase.auth);
      try {
        const requestedPath = await resolvePath(request, snapshotCase);
        const response =
          snapshotCase.method === "GET"
            ? await request.get(requestedPath, {
                headers: snapshotCase.headers,
              })
            : await request.post(requestedPath, {
                data: snapshotCase.data,
                headers: snapshotCase.headers,
              });
        const contentType = response.headers()["content-type"] ?? "";
        const text = await response.text();
        let body: unknown = text;
        if (contentType.includes("application/json")) {
          body = text ? JSON.parse(text) : null;
        }

        const responsePath = path.join(dir, "response.json");
        await writeJsonFile(responsePath, {
          id: snapshotCase.id,
          request: {
            method: snapshotCase.method,
            path: requestedPath,
            pathTemplate: snapshotCase.path,
            auth: snapshotCase.auth,
            data: snapshotCase.data,
            expectedStatus: snapshotCase.expectedStatus,
          },
          response: {
            status: response.status(),
            ok: response.ok(),
            headers: stableResponseHeaders(response.headers()),
            body,
          },
        });
        if (!contentType.includes("application/json")) {
          await writeTextFile(path.join(dir, "response.txt"), text);
        }

        const metadata = {
          id: snapshotCase.id,
          kind: "api",
          method: snapshotCase.method,
          path: requestedPath,
          pathTemplate: snapshotCase.path,
          auth: snapshotCase.auth,
          status: response.status(),
          expectedStatus: snapshotCase.expectedStatus,
          ok: response.ok(),
          contentType,
          note: snapshotCase.note,
          durationMs: Math.round(performance.now() - startedAt),
          response: relativeFromRoot(responsePath),
          responseSha256: await sha256File(responsePath),
        };
        await writeJsonFile(path.join(dir, "metadata.json"), metadata);
        entries.push(metadata);
        console.log(`api ${snapshotCase.id}: ${metadata.status}`);
      } catch (error) {
        const metadata = {
          id: snapshotCase.id,
          kind: "api",
          method: snapshotCase.method,
          path: snapshotCase.path,
          auth: snapshotCase.auth,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Math.round(performance.now() - startedAt),
        };
        await writeJsonFile(path.join(dir, "metadata.json"), metadata);
        entries.push(metadata);
        console.error(`api ${snapshotCase.id}: failed`);
      }
    }
  } finally {
    for (const context of contexts.values()) {
      await context.close();
    }
    await browser.close();
  }

  await writeJsonFile(path.join(root, "manifest.json"), {
    kind: "api",
    baseUrl,
    generatedAt: nowIso(),
    count: entries.length,
    entries,
  });
  assertNoSnapshotErrors("api", entries);
}

await main();
