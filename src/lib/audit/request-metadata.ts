import { getCloudflareRequestContext } from "@/lib/adapters/cloudflare-runtime";
import { getApiRequestObservabilityRequestId } from "@/lib/log/api-observability-context";

type AuditRequest = Pick<Request, "headers">;

const fallbackRequestIds = new WeakMap<object, string>();

function generatedRequestId(request: AuditRequest) {
  const headersObject = request.headers as object;
  const existing = fallbackRequestIds.get(headersObject);
  if (existing) return existing;

  const requestId = crypto.randomUUID();
  fallbackRequestIds.set(headersObject, requestId);
  return requestId;
}

/**
 * Return the request ID assigned by the application runtime.
 *
 * Request IDs are intentionally never read from request headers: x-request-id
 * is client-controlled and cf-ray identifies an edge event, not this request's
 * application correlation context.
 */
export function getAuditRequestId(
  request: AuditRequest,
  trustedRequestId?: string,
) {
  const normalizedTrustedRequestId = trustedRequestId?.trim();
  if (normalizedTrustedRequestId) {
    return normalizedTrustedRequestId.slice(0, 128);
  }

  const observedRequestId = getApiRequestObservabilityRequestId(
    request as Request,
  );
  if (observedRequestId) return observedRequestId;

  const runtimeRequestId = getCloudflareRequestContext()?.requestId;
  return runtimeRequestId ?? generatedRequestId(request);
}

export function getAuditRequestMetadata(
  request: AuditRequest,
  trustedRequestId?: string,
) {
  // Production traffic terminates at Cloudflare. Forwarded headers supplied by
  // arbitrary clients are not authoritative and must not enter forensic data.
  const ipAddress =
    request.headers.get("cf-connecting-ip")?.trim() || undefined;
  const userAgent = request.headers.get("user-agent")?.trim() || undefined;
  return {
    ipAddress: ipAddress?.slice(0, 64),
    requestId: getAuditRequestId(request, trustedRequestId),
    userAgent: userAgent?.slice(0, 512),
  };
}
