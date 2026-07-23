import { createCrawlerDiscoveryResponse } from "@/lib/seo/crawler-discovery-response";
import { getCanonicalOrigin } from "@/lib/site-url";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
  const origin = getCanonicalOrigin();
  const body = `# Life@USTC

> Public course, section, teacher, and campus information for the University of Science and Technology of China community.

## Catalog

- [Courses](${origin}/catalog/courses)
- [Sections](${origin}/catalog/sections)
- [Teachers](${origin}/catalog/teachers)

## Developer interfaces

- [REST API documentation](${origin}/api/docs/tag/catalog-section)
- [MCP protected resource metadata](${origin}/.well-known/oauth-protected-resource/api/mcp)
- [MCP endpoint](${origin}/api/mcp)

## Discovery

- [Sitemap](${origin}/sitemap.xml)
`;

  return createCrawlerDiscoveryResponse({
    body,
    contentType: "text/plain; charset=utf-8",
    request,
  });
};
