import { pinyin } from "pinyin-pro";

// Inputs are titles and descriptions from the bundled catalog.
const catalogTextPinyin = new Map<string, string>();

/** Lowercase pinyin (no tones, no spaces) for client-side search and IME. */
export function toSearchPinyin(text: string): string {
  if (!text.trim()) return "";
  const cached = catalogTextPinyin.get(text);
  if (cached !== undefined) return cached;
  const result = pinyin(text, { toneType: "none" })
    .replace(/\s+/g, "")
    .toLowerCase();
  catalogTextPinyin.set(text, result);
  return result;
}
