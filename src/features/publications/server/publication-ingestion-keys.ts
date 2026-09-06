import type {
  PublicationIngestionBatchRequest,
  PublicationObjectManifest,
} from "@/lib/api/schemas/request-publication-ingestion-schemas";
import {
  PUBLICATION_INGESTION_PRINCIPAL_KEY,
  type PublicationIngestionServicePrincipal,
} from "@/lib/auth/service-principal";

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function publicationIngestionPayloadDigest(
  payload: PublicationIngestionBatchRequest,
) {
  return sha256Text(JSON.stringify(canonicalize(payload)));
}

export function publicationPrincipalKey(
  _principal: PublicationIngestionServicePrincipal,
) {
  return PUBLICATION_INGESTION_PRINCIPAL_KEY;
}

export function publicationObjectKey(
  kind: PublicationObjectManifest["kind"],
  sha256: string,
) {
  return `publications/${kind}/sha256/${sha256.slice(0, 2)}/${sha256}`;
}
