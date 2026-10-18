import type { ShellFeatureGroup } from "./navigation";

export function filterShellFeatures(
  groups: ShellFeatureGroup[],
  query: string,
) {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return groups;
  return groups
    .map((group) => ({
      ...group,
      features: group.features.filter((feature) => {
        const text = [
          group.label,
          feature.label,
          feature.description,
          feature.href,
          ...(feature.items?.flatMap((item) => [item.label, item.href]) ?? []),
        ]
          .join(" ")
          .toLocaleLowerCase();
        return tokens.every((token) => text.includes(token));
      }),
    }))
    .filter((group) => group.features.length > 0);
}
