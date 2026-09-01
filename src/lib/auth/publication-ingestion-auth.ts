import { getOptionalTrimmedEnv } from "@/app-env";
import { unauthorized } from "@/lib/api/helpers";
import {
  PUBLICATION_INGESTION_SERVICE_PRINCIPAL,
  type PublicationIngestionServicePrincipal,
} from "./service-principal";

export const PUBLICATION_INGESTION_SECRET_HEADER =
  "X-Publication-Ingestion-Secret" as const;
export const PUBLICATION_INGESTION_SECRET_ENV =
  "PUBLICATION_INGESTION_SECRET" as const;

async function sha256(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

/**
 * Compare two secrets without an early return or a length-dependent branch.
 * Hashing first gives both inputs the same fixed-size representation, so a
 * missing/short/long candidate does not create a timing distinction.
 */
export async function timingSafeSecretEqual(
  candidate: string,
  expected: string,
) {
  const [candidateDigest, expectedDigest] = await Promise.all([
    sha256(candidate),
    sha256(expected),
  ]);
  let difference = candidateDigest.length ^ expectedDigest.length;
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= candidateDigest[index] ^ expectedDigest[index];
  }
  return difference === 0;
}

/**
 * Authenticate the crawler with a dedicated machine secret.
 *
 * The configured secret and the supplied header are never included in an
 * error, log context, or returned principal. Missing configuration fails
 * closed with the same response as an invalid header.
 */
export async function requirePublicationIngestionPrincipal(
  request: Request,
): Promise<PublicationIngestionServicePrincipal | Response> {
  const expected = getOptionalTrimmedEnv(PUBLICATION_INGESTION_SECRET_ENV);
  if (!expected) return unauthorized();
  const candidate =
    request.headers.get(PUBLICATION_INGESTION_SECRET_HEADER) ?? "";

  let matches = false;
  try {
    matches = await timingSafeSecretEqual(candidate, expected);
  } catch {
    return unauthorized();
  }
  if (!matches) return unauthorized();

  return PUBLICATION_INGESTION_SERVICE_PRINCIPAL;
}
