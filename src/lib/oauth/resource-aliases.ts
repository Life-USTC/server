import { resourceIndicatorsMatch } from "@/lib/oauth/utils";
import { getBetterAuthBaseUrl, getPublicOrigin } from "@/lib/site-url";

export function resolveOAuthResourceAlias(value: string) {
  const candidate = value.trim();
  if (!candidate) return value;

  try {
    if (resourceIndicatorsMatch(candidate, getPublicOrigin())) {
      return getBetterAuthBaseUrl();
    }
  } catch {
    return value;
  }

  return value;
}

export function rewriteOAuthResourceAliases(params: URLSearchParams) {
  const resources = params.getAll("resource");
  if (resources.length === 0) return false;

  let changed = false;
  params.delete("resource");
  for (const resource of resources) {
    const resolved = resolveOAuthResourceAlias(resource);
    if (resolved !== resource) changed = true;
    params.append("resource", resolved);
  }

  return changed;
}
