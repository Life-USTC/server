/**
 * Shared upload helper functions extracted from route files to avoid duplication.
 */

export function normalizeContentType(value: unknown) {
  if (typeof value !== "string") return "application/octet-stream";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "application/octet-stream";
}

const HEADER_UNSAFE_FILENAME_CHARACTERS = /[^\x20-\x7e]|["\\]/gu;

function isControlCharacter(character: string) {
  const code = character.charCodeAt(0);
  return code < 32 || code === 127;
}

export function sanitizeFilename(filename: string) {
  let sanitized = "";
  let previousWasReplacement = false;

  for (const character of filename) {
    if (isControlCharacter(character)) {
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

export function hasFilenameControlCharacters(filename: string) {
  return Array.from(filename).some(isControlCharacter);
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
