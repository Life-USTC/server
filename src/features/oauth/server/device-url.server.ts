export function callbackPath(url: URL) {
  return `${url.pathname}${url.search}`;
}

export function buildDevicePageUrl(
  values: {
    code?: string;
    step?: "approve";
    result?: "approved" | "denied" | "error";
    reason?: "missing_code" | "invalid_or_expired";
  } = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/oauth/device?${query}` : "/oauth/device";
}

export function buildDeviceCallbackUrl(rawCode: FormDataEntryValue | null) {
  if (typeof rawCode !== "string" || !rawCode.trim()) {
    return buildDevicePageUrl();
  }
  return buildDevicePageUrl({
    code: rawCode.trim(),
    step: "approve",
  });
}
