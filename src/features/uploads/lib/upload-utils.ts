/**
 * Shared upload helper functions extracted from route files to avoid duplication.
 */

export function normalizeContentType(value: unknown) {
  if (typeof value !== "string") return "application/octet-stream";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "application/octet-stream";
}

export function sanitizeFilename(filename: string) {
  return filename.trim();
}

export function buildContentDisposition(filename: string) {
  const safeName = filename.replace(/"/g, "'");
  return `attachment; filename="${safeName}"`;
}
