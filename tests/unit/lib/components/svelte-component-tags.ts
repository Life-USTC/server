/** Component tag scanning shared by the Svelte source guards. */

const COMPONENT_TAG = /[A-Z][\w.]*/y;

export type ComponentTag = {
  /** Everything between the tag name and the closing `>`, minus a `/`. */
  attributes: string;
  /** Offset of the opening `<`, for reporting a line number. */
  index: number;
  tag: string;
};

/**
 * Scan for component tags rather than matching them with one pattern.
 * Attribute values nest both quotes and braces, and a single regular
 * expression that allows both backtracks exponentially on repeated `{{}}`
 * (CodeQL "inefficient regular expression"); this walk is linear.
 */
export function* componentTags(text: string): Generator<ComponentTag> {
  for (
    let start = text.indexOf("<");
    start >= 0;
    start = text.indexOf("<", start + 1)
  ) {
    COMPONENT_TAG.lastIndex = start + 1;
    const tag = COMPONENT_TAG.exec(text)?.[0];
    if (!tag) continue;
    const attributesStart = start + 1 + tag.length;
    let cursor = attributesStart;
    let depth = 0;
    let quote = "";
    for (; cursor < text.length; cursor += 1) {
      const char = text[cursor];
      if (quote) {
        if (char === quote) quote = "";
      } else if (char === '"' || char === "'") quote = char;
      else if (char === "{") depth += 1;
      else if (char === "}") depth = Math.max(0, depth - 1);
      else if (depth === 0 && (char === ">" || char === "<")) break;
    }
    // A `<` before the closing `>`, or an unterminated tag, is not an element.
    if (text[cursor] !== ">") continue;
    const attributesEnd = text[cursor - 1] === "/" ? cursor - 1 : cursor;
    yield {
      attributes: text.slice(attributesStart, attributesEnd),
      index: start,
      tag,
    };
  }
}
