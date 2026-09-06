import { Prisma } from "@/generated/prisma/client";
import type { PublicationIngestionBatchRequest } from "@/lib/api/schemas/request-publication-ingestion-schemas";
import type { PublicationIngestionServicePrincipal } from "@/lib/auth/service-principal";
import { prisma } from "@/lib/db/prisma";
import {
  PUBLICATION_INGESTION_TRANSACTION_TIMEOUT_MS,
  type PublicationIngestionBatchResult,
  PublicationIngestionConflictError,
  type PublicationIngestionItemResult,
} from "./publication-ingestion-errors";
import {
  ingestItem,
  type RegisteredSource,
  result,
  validateSourceDescriptors,
} from "./publication-ingestion-item";
import {
  publicationIngestionPayloadDigest,
  publicationPrincipalKey,
} from "./publication-ingestion-keys";
import { parsePublicationDate } from "./publication-ingestion-revision-semantics";

export { PUBLICATION_INGESTION_BATCH_MAX_ITEMS } from "@/features/publications/lib/publication-ingestion-limits";

export {
  PUBLICATION_INGESTION_TRANSACTION_TIMEOUT_MS,
  PublicationIngestionBadRequestError,
  type PublicationIngestionBatchResult,
  PublicationIngestionConflictError,
  type PublicationIngestionItemResult,
} from "./publication-ingestion-errors";

export {
  publicationIngestionPayloadDigest,
  publicationObjectKey,
  publicationPrincipalKey,
} from "./publication-ingestion-keys";

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function storedResult(
  value: Prisma.JsonValue | null,
): PublicationIngestionBatchResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored ingestion result is invalid");
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.batchId !== "string" ||
    typeof record.clientRunId !== "string" ||
    typeof record.payloadDigest !== "string" ||
    !Array.isArray(record.results)
  ) {
    throw new Error("Stored ingestion result is invalid");
  }
  return record as unknown as PublicationIngestionBatchResult;
}

async function ingestWithRetry(
  _principal: PublicationIngestionServicePrincipal,
  payload: PublicationIngestionBatchRequest,
  payloadDigest: string,
  principalKey: string,
) {
  const response = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.ingestionBatch.findUnique({
        where: {
          principalKey_batchId: { principalKey, batchId: payload.batchId },
        },
      });
      if (existing) {
        if (existing.payloadDigest !== payloadDigest) {
          throw new PublicationIngestionConflictError(
            "The batch ID was already used with a different payload",
          );
        }
        return storedResult(existing.result);
      }

      validateSourceDescriptors(payload);
      const run = await tx.ingestionRun.upsert({
        where: {
          principalKey_clientRunId: {
            principalKey,
            clientRunId: payload.clientRunId,
          },
        },
        create: {
          clientRunId: payload.clientRunId,
          principalKey,
          observedAt: parsePublicationDate(payload.observedAt),
        },
        update: {
          observedAt: parsePublicationDate(payload.observedAt),
          status: "running",
        },
      });

      const registeredSources = new Map<string, RegisteredSource>();
      for (const source of payload.sources) {
        const registered = await tx.publicationSource.upsert({
          where: { id: source.id },
          create: {
            id: source.id,
            name: source.name,
            organizationLevel: source.organizationLevel ?? "unknown",
            allowedHosts: source.allowedHosts ?? [],
            blockedHosts: source.blockedHosts ?? [],
            seedUrls: source.seedUrls ?? [],
            aliases: source.aliases ?? [],
            discoveryOnly: source.discoveryOnly ?? false,
            maxImagesPerPage: source.maxImagesPerPage ?? null,
          },
          update: {
            name: source.name,
            ...(source.organizationLevel === undefined
              ? {}
              : { organizationLevel: source.organizationLevel }),
            ...(source.allowedHosts === undefined
              ? {}
              : { allowedHosts: source.allowedHosts }),
            ...(source.blockedHosts === undefined
              ? {}
              : { blockedHosts: source.blockedHosts }),
            ...(source.seedUrls === undefined
              ? {}
              : { seedUrls: source.seedUrls }),
            ...(source.aliases === undefined
              ? {}
              : { aliases: source.aliases }),
            ...(source.discoveryOnly === undefined
              ? {}
              : { discoveryOnly: source.discoveryOnly }),
            ...(source.maxImagesPerPage === undefined
              ? {}
              : { maxImagesPerPage: source.maxImagesPerPage }),
          },
        });
        registeredSources.set(source.id, {
          id: registered.id,
          name: registered.name,
          organizationLevel: registered.organizationLevel,
          allowedHosts: source.allowedHosts ?? registered.allowedHosts,
          blockedHosts: source.blockedHosts ?? registered.blockedHosts,
          seedUrls: source.seedUrls ?? registered.seedUrls,
          aliases: source.aliases ?? registered.aliases,
          discoveryOnly: source.discoveryOnly ?? registered.discoveryOnly,
          maxImagesPerPage:
            source.maxImagesPerPage === undefined
              ? registered.maxImagesPerPage
              : source.maxImagesPerPage,
          enabled: registered.enabled,
          allowAnyHost:
            (source.allowedHosts ?? registered.allowedHosts).length === 0,
        });
      }

      const batch = await tx.ingestionBatch.create({
        data: {
          batchId: payload.batchId,
          runId: run.id,
          principalKey,
          payloadDigest,
          itemCount: payload.items.length,
        },
      });

      const results: PublicationIngestionItemResult[] = [];
      for (const item of payload.items) {
        const source = registeredSources.get(item.sourceId);
        if (!source?.enabled || source.discoveryOnly) {
          results.push(
            result(
              item,
              "rejected",
              null,
              null,
              source && !source.enabled
                ? "source is disabled"
                : source
                  ? "discovery-only source cannot ingest publications"
                  : "source is not registered in this batch",
            ),
          );
          continue;
        }
        results.push(await ingestItem(tx, batch.id, item, source));
      }

      const response: PublicationIngestionBatchResult = {
        batchId: payload.batchId,
        clientRunId: payload.clientRunId,
        payloadDigest,
        results,
      };
      await tx.ingestionBatch.update({
        where: { id: batch.id },
        data: { result: response as unknown as Prisma.InputJsonObject },
      });
      await tx.ingestionRun.update({
        where: { id: run.id },
        data: { status: "completed" },
      });
      return response;
    },
    { timeout: PUBLICATION_INGESTION_TRANSACTION_TIMEOUT_MS },
  );

  return response;
}

export async function ingestPublicationBatch(input: {
  payload: PublicationIngestionBatchRequest;
  principal: PublicationIngestionServicePrincipal;
}) {
  const { payload, principal } = input;
  const principalKey = publicationPrincipalKey(principal);
  const payloadDigest = await publicationIngestionPayloadDigest(payload);
  try {
    return await ingestWithRetry(
      principal,
      payload,
      payloadDigest,
      principalKey,
    );
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await prisma.ingestionBatch.findUnique({
      where: {
        principalKey_batchId: { principalKey, batchId: payload.batchId },
      },
    });
    if (!existing) throw error;
    if (existing.payloadDigest !== payloadDigest) {
      throw new PublicationIngestionConflictError(
        "The batch ID was already used with a different payload",
      );
    }
    return storedResult(existing.result);
  }
}
