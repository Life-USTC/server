import * as z from "zod";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const artifactSchema = z.strictObject({
  sha256,
  size: z.number().int().nonnegative(),
});
const downloadableArtifactSchema = artifactSchema.extend({
  url: z.string().min(1),
});

export const staticSnapshotManifestSchema = z.strictObject({
  manifestVersion: z.literal(1),
  snapshotSchemaVersion: z.string().min(1),
  generatedAt: z.string().min(1),
  health: z.enum(["complete", "degraded"]),
  sourceAvailability: z.strictObject({
    unavailableCurriculumSemesterJwIds: z.array(z.number().int().positive()),
    unavailableExamSemesterJwIds: z.array(z.number().int().positive()),
  }),
  snapshot: artifactSchema,
  compressedSnapshot: downloadableArtifactSchema,
});

export type StaticSnapshotManifest = z.output<
  typeof staticSnapshotManifestSchema
>;
export type SnapshotFetch = typeof fetch;

function httpUrl(value: string | URL) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "Static snapshot URLs must be credential-free HTTP(S) URLs",
    );
  }
  return url;
}

export function snapshotArtifactUrl(manifestUrl: string | URL, path: string) {
  return httpUrl(new URL(path, httpUrl(manifestUrl))).toString();
}

export async function readStaticSnapshotManifest(
  manifestUrl: string,
  fetchImpl: SnapshotFetch = fetch,
): Promise<StaticSnapshotManifest> {
  const url = httpUrl(manifestUrl);
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(
      `Snapshot manifest download failed (HTTP ${response.status})`,
    );
  }
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > 65_536) throw new Error("Snapshot manifest is too large");
  const text = await response.text();
  if (new TextEncoder().encode(text).length > 65_536) {
    throw new Error("Snapshot manifest is too large");
  }
  return staticSnapshotManifestSchema.parse(JSON.parse(text));
}
