type AuditQueryValue = boolean | number | string | null | undefined;

export function buildAdminAuditHref(
  filters: Record<string, AuditQueryValue>,
  cursor?: string,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  if (cursor) query.set("cursor", cursor);
  const suffix = query.toString();
  return suffix ? `/admin/audit?${suffix}` : "/admin/audit";
}
