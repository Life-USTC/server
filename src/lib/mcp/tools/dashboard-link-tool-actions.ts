import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  linkMatchesTokens,
  searchQueryToTokens,
} from "@/features/dashboard-links/lib/dashboard-link-search";
import {
  type DashboardLinkSummary,
  getPublicDashboardLinksData,
} from "@/features/dashboard-links/server/dashboard-link-data";
import {
  getDashboardLinkPinnedSlugs,
  MAX_PINNED_LINKS,
  resolveDashboardLinkBySlug,
  updateDashboardLinkPinState,
} from "@/features/dashboard-links/server/dashboard-link-service";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";

type ToolExtra = { authInfo?: AuthInfo };
type McpModeInput = Parameters<typeof resolveMcpMode>[0];
function normalizeDashboardLinkQuery(query: string | undefined) {
  const normalized = query?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : null;
}

function dashboardLinkToolSummary(link: DashboardLinkSummary) {
  return {
    slug: link.slug,
    title: link.title,
    url: link.url,
    description: link.description,
    icon: link.icon,
    group: link.group,
  };
}

export async function listDashboardLinksTool({
  query,
  mode,
}: {
  query?: string;
  mode?: McpModeInput;
}) {
  const resolvedMode = resolveMcpMode(mode);
  const data = getPublicDashboardLinksData();
  const normalizedQuery = normalizeDashboardLinkQuery(query);
  const tokens = normalizedQuery ? searchQueryToTokens(normalizedQuery) : [];
  const links =
    tokens.length === 0
      ? data.dashboardLinks
      : data.dashboardLinks.filter((link) => linkMatchesTokens(link, tokens));

  return jsonToolResult(
    {
      success: true,
      query: normalizedQuery,
      total: data.dashboardLinks.length,
      returned: links.length,
      links: links.map(dashboardLinkToolSummary),
    },
    { mode: resolvedMode },
  );
}

export async function listDashboardLinkPinsTool(
  { mode }: { mode?: McpModeInput },
  extra: ToolExtra,
) {
  const pinnedSlugs = await getDashboardLinkPinnedSlugs(
    getUserId(extra.authInfo),
  );
  return jsonToolResult(
    { success: true, pinnedSlugs, maxPinnedLinks: MAX_PINNED_LINKS },
    { mode: resolveMcpMode(mode) },
  );
}

export async function setDashboardLinkPinStateTool(
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
  const link = resolveDashboardLinkBySlug(slug);

  if (!link) {
    const pinnedSlugs = await getDashboardLinkPinnedSlugs(userId);
    return jsonToolResult(
      {
        success: false,
        error: "invalid_slug",
        message: `Unknown dashboard link slug: ${slug}`,
        slug,
        pinnedSlugs,
        maxPinnedLinks: MAX_PINNED_LINKS,
      },
      { mode: resolvedMode },
    );
  }

  const pinnedSlugs = await updateDashboardLinkPinState({
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
