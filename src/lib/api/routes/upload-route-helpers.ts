import { parseInteger, parseRouteInput } from "@/lib/api/helpers";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";

export const MAX_UPLOAD_EXPIRES_SECONDS = 300;

type IdParams = { id: string };

type PublicUpload = {
  createdAt: Date | string;
  filename: string;
  id: string;
  key: string;
  size: number;
};

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseFileSize(value: unknown) {
  return parseInteger(value);
}

export function parseUploadId(params: IdParams) {
  return parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid upload ID",
  );
}

export function publicUploadPayload(upload: PublicUpload) {
  return {
    id: upload.id,
    key: upload.key,
    filename: upload.filename,
    size: upload.size,
    createdAt: upload.createdAt,
  };
}

export function uploadPreviewHtml(filename: string, url: string) {
  const escapedFilename = escapeHtml(filename);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapedFilename}</title></head><body><main><h1>${escapedFilename}</h1><p><a href="${escapeHtml(url)}">Download attachment</a></p></main></body></html>`;
}
