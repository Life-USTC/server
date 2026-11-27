import { renderEmbeddedMarkdown } from "@/lib/components/markdown-preview-renderer";

// Bound retained Markdown and HTML to about 2 MiB of UTF-16 text per isolate.
const maxCharacters = 1024 * 1024;
const renderedBodies = new Map<string, string>();
let characters = 0;

/** Reuse sanitized markup before applying revision-specific image metadata. */
export function renderPublicationBody(markdown: string): string {
  const cached = renderedBodies.get(markdown);
  if (cached !== undefined) {
    renderedBodies.delete(markdown);
    renderedBodies.set(markdown, cached);
    return cached;
  }

  const html = renderEmbeddedMarkdown(markdown);
  const size = markdown.length + html.length;
  if (!html || size > maxCharacters) return html;

  for (const [body, rendered] of renderedBodies) {
    if (characters + size <= maxCharacters && renderedBodies.size < 128) break;
    renderedBodies.delete(body);
    characters -= body.length + rendered.length;
  }
  renderedBodies.set(markdown, html);
  characters += size;
  return html;
}
