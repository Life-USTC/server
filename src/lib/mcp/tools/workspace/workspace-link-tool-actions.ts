import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  linkMatchesTokens,
  searchQueryToTokens,
} from "@/features/catalog-links/lib/catalog-link-search";
import {
  type CatalogLinkSummary,
  getPublicCatalogLinksData,
} from "@/features/catalog-links/server/catalog-link-data";
import {
  getWorkspaceLinkPinnedSlugs,
  MAX_PINNED_LINKS,
  resolveCatalogLinkBySlug,
  updateWorkspaceLinkPinState,
} from "@/features/catalog-links/server/catalog-link-service";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_shared/helpers";

type ToolExtra = { authInfo?: AuthInfo };
type McpModeInput = Parameters<typeof resolveMcpMode>[0];
function normalizeCatalogLinkQuery(query: string | undefined) {
  const normalized = query?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : null;
}

function catalogLinkToolSummary(link: CatalogLinkSummary) {
  return {
    slug: link.slug,
    title: link.title,
    url: link.url,
    description: link.description,
    icon: link.icon,
    group: link.group,
  };
}

export async function listCatalogLinksTool({
  query,
  mode,
}: {
  query?: string;
  mode?: McpModeInput;
}) {
  const resolvedMode = resolveMcpMode(mode);
  const data = getPublicCatalogLinksData();
  const normalizedQuery = normalizeCatalogLinkQuery(query);
  const tokens = normalizedQuery ? searchQueryToTokens(normalizedQuery) : [];
  const links =
    tokens.length === 0
      ? data.catalogLinks
      : data.catalogLinks.filter((link) => linkMatchesTokens(link, tokens));

  return jsonToolResult(
    {
      success: true,
      query: normalizedQuery,
      total: data.catalogLinks.length,
      returned: links.length,
      links: links.map(catalogLinkToolSummary),
    },
    { mode: resolvedMode },
  );
}

export async function listWorkspaceLinkPinsTool(
  { mode }: { mode?: McpModeInput },
  extra: ToolExtra,
) {
  const pinnedSlugs = await getWorkspaceLinkPinnedSlugs(
    getUserId(extra.authInfo),
  );
  return jsonToolResult(
    { success: true, pinnedSlugs, maxPinnedLinks: MAX_PINNED_LINKS },
    { mode: resolveMcpMode(mode) },
  );
}

export async function setWorkspaceLinkPinStateTool(
  {
    action,
    slug,
    mode,
  }: {
    action: "pin" | "unpin";
    slug: string;
    mode?: McpModeInput;
  },
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);
  const link = resolveCatalogLinkBySlug(slug);

  if (!link) {
    const pinnedSlugs = await getWorkspaceLinkPinnedSlugs(userId);
    return jsonToolResult(
      {
        success: false,
        error: "invalid_slug",
        message: `Unknown catalog link slug: ${slug}`,
        slug,
        pinnedSlugs,
        maxPinnedLinks: MAX_PINNED_LINKS,
      },
      { mode: resolvedMode },
    );
  }

  const pinnedSlugs = await updateWorkspaceLinkPinState({
    action,
    slug: link.slug,
    userId,
  });

  return jsonToolResult(
    {
      success: true,
      action,
      slug: link.slug,
      pinnedSlugs,
      maxPinnedLinks: MAX_PINNED_LINKS,
    },
    { mode: resolvedMode },
  );
}
