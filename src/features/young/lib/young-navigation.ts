const root = "/catalog/young-events";

/** Only catalog browse routes may be used as a detail-page return destination. */
export function youngReturnHref(value: string | null): string {
  if (!value?.startsWith(`${root}`) || value.startsWith("//")) return root;
  const url = new URL(value, "https://catalog.invalid");
  if (
    url.origin !== "https://catalog.invalid" ||
    (![root, `${root}/calendar`, `${root}/organizers`].includes(url.pathname) &&
      !/^\/catalog\/young-events\/organizers\/[^/]+$/.test(url.pathname))
  )
    return root;
  return `${url.pathname}${url.search}`;
}

export function youngDetailHref(id: string, url: URL): string {
  return `${root}/${encodeURIComponent(id)}?${new URLSearchParams({ returnTo: youngReturnHref(url.pathname + url.search) })}`;
}

export function removeYoungFilter(url: URL, key: string): string {
  const params = new URLSearchParams(url.searchParams);
  params.delete(key);
  params.delete("page");
  if (key === "dateUnknown") params.delete("timeBasis");
  return params.size ? `${url.pathname}?${params}` : url.pathname;
}
