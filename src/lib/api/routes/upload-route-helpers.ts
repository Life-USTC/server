import { uploadConfig } from "@/features/uploads/lib/upload-config";
import {
  normalizeContentType,
  sanitizeFilename,
} from "@/features/uploads/lib/upload-utils";
import {
  badRequest,
  parseRouteInput,
  payloadTooLarge,
} from "@/lib/api/helpers";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";

type IdParams = { id: string };

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseFileSize(value: unknown) {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number.parseInt(trimmed, 10);
}

export function parseUploadId(params: IdParams) {
  return parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid upload ID",
  );
}

export function parseUploadCreateInput(input: {
  contentType?: string;
  filename: string;
  size: number | string;
}) {
  const size = parseFileSize(input.size);
  if (size == null || size <= 0) {
    return badRequest("Invalid upload size");
  }
  if (size > uploadConfig.maxFileSizeBytes) {
    return payloadTooLarge("File too large");
  }

  const filename = sanitizeFilename(input.filename);
  if (!filename) {
    return badRequest("Filename required");
  }

  return {
    contentType: normalizeContentType(input.contentType),
    filename,
    size,
  };
}

export function uploadPreviewHtml(filename: string, url: string) {
  const escapedFilename = escapeHtml(filename);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapedFilename}</title></head><body><main><h1>${escapedFilename}</h1><p><a href="${escapeHtml(url)}">Download attachment</a></p></main></body></html>`;
}
