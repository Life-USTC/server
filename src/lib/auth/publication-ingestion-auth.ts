import { getOptionalTrimmedEnv } from "@/app-env";
import { unauthorized } from "@/lib/api/helpers";
import { timingSafeSecretEqual } from "./secret-comparison";
import {
  PUBLICATION_INGESTION_SERVICE_PRINCIPAL,
  type PublicationIngestionServicePrincipal,
} from "./service-principal";

export const PUBLICATION_INGESTION_SECRET_HEADER =
  "X-Publication-Ingestion-Secret" as const;
export const PUBLICATION_INGESTION_SECRET_ENV =
  "PUBLICATION_INGESTION_SECRET" as const;

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
