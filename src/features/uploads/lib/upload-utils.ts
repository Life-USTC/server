/**
 * Shared upload helper functions extracted from route files to avoid duplication.
 */

import { isAsciiControlCharacter } from "@/lib/text/ascii-control-characters";

export function normalizeContentType(value: unknown) {
  if (typeof value !== "string") return "application/octet-stream";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "application/octet-stream";
}

const HEADER_UNSAFE_FILENAME_CHARACTERS = /[^\x20-\x7e]|["\\]/gu;

export function sanitizeFilename(filename: string) {
  let sanitized = "";
  let previousWasReplacement = false;

  for (const character of filename) {
    if (isAsciiControlCharacter(character)) {
      if (!previousWasReplacement) {
        sanitized += " ";
        previousWasReplacement = true;
      }
      continue;
    }

    sanitized += character;
    previousWasReplacement = false;
  }

  return sanitized.trim();
}

export function buildContentDisposition(filename: string) {
  const safeName = sanitizeFilename(filename) || "download";
  const fallbackName =
    safeName.replace(HEADER_UNSAFE_FILENAME_CHARACTERS, "_") || "download";
  const encodedName = encodeURIComponent(safeName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}
