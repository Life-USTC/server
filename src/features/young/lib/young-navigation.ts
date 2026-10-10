const root = "/catalog/young-events";

export function youngDetailHref(id: string): string {
  return `${root}/${encodeURIComponent(id)}`;
}

export function removeYoungFilter(url: URL, key: string): string {
  const params = new URLSearchParams(url.searchParams);
  params.delete(key);
  params.delete("page");
  if (key === "dateUnknown") params.delete("timeBasis");
  return params.size ? `${url.pathname}?${params}` : url.pathname;
}
