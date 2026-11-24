import { createHash } from "node:crypto";
import type { PrismaClient } from "../generated/prisma-node/client";
import { CATALOG_EDGE_CACHE_TAG } from "./edge-cache-purge";
import { STATIC_IMPORT_TRANSFORM_REVISION } from "./import-state";
import type { ImportReport } from "./import-types";
import { runPostImportCachePurge } from "./post-import-cache-purge";

export async function purgeImportGeneration(
  prisma: Pick<PrismaClient, "staticImportState">,
  report: Pick<ImportReport, "outcome" | "snapshot">,
) {
  const zone = process.env.CLOUDFLARE_ZONE_ID?.trim();
  const origin = process.env.APP_PUBLIC_ORIGIN?.trim();
  if (
    report.outcome === "rolled-back" ||
    !zone ||
    !origin ||
    !process.env.CLOUDFLARE_API_TOKEN?.trim() ||
    !process.env.EDGE_CACHE_PURGE_SECRET?.trim()
  ) {
    return runPostImportCachePurge(report);
  }

  const target = createHash("sha256")
    .update(
      JSON.stringify([zone, new URL(origin).origin, CATALOG_EDGE_CACHE_TAG]),
    )
    .digest("hex");
  const id = `purge:catalog:${target}`;
  const state = prisma.staticImportState;
  const current = await state.findUnique({ where: { id: "global" } });
  if (
    current?.snapshotSha256 !== report.snapshot.sha256 ||
    current.transformRevision !== STATIC_IMPORT_TRANSFORM_REVISION
  ) {
    // A newer import can commit between our transaction and its purge.
    return runPostImportCachePurge(report);
  }

  const generation = {
    snapshotSha256: current.snapshotSha256,
    transformRevision: current.transformRevision,
    snapshotGeneratedAt: current.updatedAt,
  };
  if (report.outcome === "unchanged") {
    const receipt = await state.findUnique({ where: { id } });
    if (
      receipt?.snapshotSha256 === generation.snapshotSha256 &&
      receipt.transformRevision === generation.transformRevision &&
      receipt.snapshotGeneratedAt.getTime() === current.updatedAt.getTime()
    ) {
      console.log("Both catalog cache layers already purged for this import.");
      return {
        failed: false,
        workerEntrypoint: "not-run",
        zone: "not-run",
      } as const;
    }
  }

  const result = await runPostImportCachePurge(report);
  if (result.zone === "purged" && result.workerEntrypoint === "purged") {
    // A late writer can only record the generation observed before its purge.
    await state.upsert({
      where: { id },
      create: { id, ...generation },
      update: generation,
    });
  }
  return result;
}
