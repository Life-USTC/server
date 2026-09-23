/**
 * Shared publication title normalization for "reprint folding" (see issue
 * #1068): news.ustc.edu.cn republishes the same article under multiple
 * section canonical URLs. To group those reprints in list views without
 * touching crawler data, both the app and the database compute the same
 * fold key from a title.
 *
 * This function MUST stay byte-for-byte equivalent to the generated SQL
 * expression used for the `Publication.normalizedTitle` STORED column in
 * prisma/migrations/20260917000000_add_publication_fold_columns/migration.sql.
 * If you change one, change the other and add/adjust unit tests here.
 *
 * Rules (deliberately conservative — prefer under-folding to over-folding):
 * 1. Unicode NFKC normalization. This folds full-width Latin letters/digits
 *    and most full-width ASCII punctuation to their half-width equivalents
 *    (e.g. "Ａ" -> "A", "０" -> "0", "（" -> "(", "－" -> "-"). NFKC does NOT
 *    decompose CJK bracket/quote punctuation such as《》【】""''—, so titles
 *    that differ only in that style of punctuation are intentionally NOT
 *    folded together; folding those is a distinct, riskier normalization
 *    step this feature does not take.
 * 2. Strip invisible/zero-width formatting characters that carry no visual
 *    meaning: zero-width space/non-joiner/joiner (U+200B-200D), word joiner
 *    (U+2060), BOM/zero-width no-break space (U+FEFF), and soft hyphen
 *    (U+00AD). These are stripped outright (not replaced with a space).
 * 3. Collapse all whitespace runs (including the ideographic space U+3000
 *    and NBSP U+00A0, which \s matches in both ICU-aware JS regex and
 *    Postgres's \s) to a single ASCII space, then trim.
 * 4. Lowercase the result (case folding for the rare Latin-script title).
 *
 * This function does NOT strip ordinary punctuation, digits, or CJK
 * characters, and does NOT attempt fuzzy/edit-distance matching — two
 * articles with genuinely different titles are never folded together.
 */

// Written as explicit escapes because the literals are invisible in an editor.
// Must stay in lockstep with the chr() list in the normalizedTitle generated
// column (prisma/migrations/20260917000000_add_publication_fold_columns).
//
// U+200D (ZERO WIDTH JOINER) is matched on its own rather than inside the
// class: noMisleadingCharacterClass rejects it in a class because the class
// would match one half of a joined emoji sequence. These are news headlines,
// so a stray joiner is noise and stripping it is correct, but keeping it out
// of the class keeps that decision explicit instead of suppressed.
const INVISIBLE_CHARACTERS_PATTERN = /[\u200b\u200c\u2060\ufeff\u00ad]/gu;
const ZERO_WIDTH_JOINER_PATTERN = /\u200d/gu;
const WHITESPACE_RUN_PATTERN = /\s+/g;

export function normalizePublicationTitle(title: string): string {
  return title
    .normalize("NFKC")
    .replace(INVISIBLE_CHARACTERS_PATTERN, "")
    .replace(ZERO_WIDTH_JOINER_PATTERN, "")
    .replace(WHITESPACE_RUN_PATTERN, " ")
    .trim()
    .toLowerCase();
}
