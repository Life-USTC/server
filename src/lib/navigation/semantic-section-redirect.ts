type SemanticSectionRedirectInput = {
  basePath: string;
  defaultSection: string;
  method: string;
  resolveSection: (value: string | null) => string | null;
  url: URL;
};

export function semanticSectionCompatibilityHref({
  basePath,
  defaultSection,
  method,
  resolveSection,
  url,
}: SemanticSectionRedirectInput) {
  if ((method !== "GET" && method !== "HEAD") || url.pathname !== basePath) {
    return null;
  }

  const section = resolveSection(url.searchParams.get("tab")) ?? defaultSection;
  const query = new URLSearchParams(url.searchParams);
  query.delete("tab");
  const search = query.toString();

  return `${basePath}/${section}${search ? `?${search}` : ""}`;
}
