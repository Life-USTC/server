export function getAuditRequestMetadata(request: Pick<Request, "headers">) {
  // Production traffic terminates at Cloudflare. Forwarded headers supplied by
  // arbitrary clients are not authoritative and must not enter forensic data.
  const ipAddress =
    request.headers.get("cf-connecting-ip")?.trim() || undefined;
  const userAgent = request.headers.get("user-agent")?.trim() || undefined;
  const requestId =
    request.headers.get("cf-ray")?.trim() ||
    request.headers.get("x-request-id")?.trim() ||
    undefined;
  return {
    ipAddress: ipAddress?.slice(0, 64),
    requestId: requestId?.slice(0, 128),
    userAgent: userAgent?.slice(0, 512),
  };
}
