import { CONTENT_SIGNAL } from "@/lib/seo/content-signal";
import { getCanonicalOrigin } from "@/lib/site-url";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () => {
  const origin = getCanonicalOrigin();
  const body = `# Life@USTC

> Public course, section, teacher, and campus information for the University of Science and Technology of China community.

## Catalog

- [Courses](${origin}/courses)
- [Sections](${origin}/sections)
- [Teachers](${origin}/teachers)

## Developer interfaces

- [REST API documentation](${origin}/api/docs/tag/sections)
- [MCP protected resource metadata](${origin}/.well-known/oauth-protected-resource/api/mcp)
- [MCP endpoint](${origin}/api/mcp)

## Discovery

- [Sitemap](${origin}/sitemap.xml)
`;

  return new Response(body, {
    headers: {
      "Content-Signal": CONTENT_SIGNAL,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
