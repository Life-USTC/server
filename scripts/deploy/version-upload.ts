import { z } from "zod";
import { candidateSchema } from "./promotion-evidence";

/** Wrangler's versioned NDJSON output, never its human-readable terminal text. */
export function uploadedCandidate(
  output: string,
  commit: string,
  worker: string,
) {
  const records: unknown[] = output
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  const uploads = records.filter(
    (record) =>
      record !== null &&
      typeof record === "object" &&
      "type" in record &&
      record.type === "version-upload",
  );
  if (uploads.length !== 1)
    throw new Error("Expected exactly one version upload record.");
  const upload = z
    .object({
      type: z.literal("version-upload"),
      version: z.literal(1),
      worker_name: z.literal(worker),
      version_id: z.uuid(),
    })
    .parse(uploads[0]);
  return candidateSchema.parse({ commit, version: upload.version_id });
}
