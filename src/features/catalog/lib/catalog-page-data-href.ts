export type CatalogPageDataKind = "courses" | "sections" | "teachers";

export function catalogPageDataHref(
  kind: CatalogPageDataKind,
  pageHref: string,
) {
  const queryStart = pageHref.indexOf("?");
  if (queryStart === -1) return `/catalog/_data/${kind}`;

  const hashStart = pageHref.indexOf("#", queryStart);
  const query =
    hashStart === -1
      ? pageHref.slice(queryStart)
      : pageHref.slice(queryStart, hashStart);

  return `/catalog/_data/${kind}${query}`;
}
