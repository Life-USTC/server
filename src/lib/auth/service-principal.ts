/**
 * Stable non-user identity for the publication crawler.
 *
 * This identity is deliberately represented outside the User table. The
 * ingestion protocol authenticates the caller with a Worker secret and uses
 * this key only for ownership and idempotency boundaries in ingestion rows.
 */
export const PUBLICATION_INGESTION_SERVICE_ID = "publication-crawler" as const;
export const PUBLICATION_INGESTION_PRINCIPAL_KEY =
  "service:publication-crawler" as const;

export type PublicationIngestionServicePrincipal = {
  readonly kind: "service";
  readonly serviceId: typeof PUBLICATION_INGESTION_SERVICE_ID;
  readonly principalKey: typeof PUBLICATION_INGESTION_PRINCIPAL_KEY;
};

export const PUBLICATION_INGESTION_SERVICE_PRINCIPAL = {
  kind: "service",
  serviceId: PUBLICATION_INGESTION_SERVICE_ID,
  principalKey: PUBLICATION_INGESTION_PRINCIPAL_KEY,
} as const satisfies PublicationIngestionServicePrincipal;
