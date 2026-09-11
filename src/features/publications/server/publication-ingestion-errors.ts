/**
 * A full publication batch is allowed to contain 100 items. The associated
 * writes can take about 20 seconds in production, so allow enough time for
 * database contention while staying below the crawler's 60-second request
 * timeout.
 */
export const PUBLICATION_INGESTION_TRANSACTION_TIMEOUT_MS = 45_000;

/**
 * Transient transaction failures (P2028 interactive-transaction timeouts,
 * serialization conflicts) abort the whole batch write with no rows
 * retained, so the transaction can be retried a bounded number of times.
 * A retry after a partially visible commit still resolves through the
 * batchId/payload-digest re-read instead of double-ingesting.
 */
export const PUBLICATION_INGESTION_TRANSACTION_MAX_ATTEMPTS = 3;
export const PUBLICATION_INGESTION_TRANSACTION_RETRY_DELAY_MS = 200;

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
