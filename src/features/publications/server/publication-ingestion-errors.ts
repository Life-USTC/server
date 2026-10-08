/**
 * A full publication batch is allowed to contain 100 items. The associated
 * writes can take about 20 seconds in production, so allow enough time for
 * database contention while staying below the crawler's 60-second request
 * timeout.
 */
export const PUBLICATION_INGESTION_TRANSACTION_TIMEOUT_MS = 45_000;

/**
 * Retry serialization conflicts, which roll back the entire transaction.
 * A transaction timeout is returned to the crawler immediately: repeating the
 * same work here can outlive its request timeout and overlap client retries.
 */
export const PUBLICATION_INGESTION_TRANSACTION_MAX_ATTEMPTS = 3;
export const PUBLICATION_INGESTION_TRANSACTION_RETRY_DELAY_MS = 200;

export class PublicationIngestionBadRequestError extends Error {
  readonly code = "publication_ingestion_bad_request";
}

export class PublicationIngestionConflictError extends Error {
  readonly code = "publication_ingestion_conflict";
}

export type PublicationIngestionObjectUploadRequirement = {
  kind: "body_html" | "body_markdown" | "media" | "asset" | "raw_page";
  sha256: string;
};

export type PublicationIngestionItemResult = {
  canonicalUrl: string;
  revisionHash: string;
  sourceId: string;
  error?: string;
  publicationId: string | null;
  revisionId: string | null;
  status: "created" | "updated" | "unchanged" | "rejected";
  /**
   * Present only on unchanged results whose re-registered object claims lack
   * verified bytes in storage. The client should plan and upload these
   * objects against the current batch even though the item is unchanged.
   */
  objectsNeedingUpload?: PublicationIngestionObjectUploadRequirement[];
};

export type PublicationIngestionBatchResult = {
  batchId: string;
  clientRunId: string;
  payloadDigest: string;
  results: PublicationIngestionItemResult[];
};
