/**
 * A full publication batch is allowed to contain 100 items. The associated
 * writes can take about 20 seconds in production, so allow enough time for
 * database contention while staying below the crawler's 60-second request
 * timeout.
 */
export const PUBLICATION_INGESTION_TRANSACTION_TIMEOUT_MS = 45_000;

export class PublicationIngestionBadRequestError extends Error {
  readonly code = "publication_ingestion_bad_request";
}

export class PublicationIngestionConflictError extends Error {
  readonly code = "publication_ingestion_conflict";
}

export type PublicationIngestionItemResult = {
  canonicalUrl: string;
  revisionHash: string;
  sourceId: string;
  error?: string;
  publicationId: string | null;
  revisionId: string | null;
  status: "created" | "updated" | "unchanged" | "rejected";
};

export type PublicationIngestionBatchResult = {
  batchId: string;
  clientRunId: string;
  payloadDigest: string;
  results: PublicationIngestionItemResult[];
};
