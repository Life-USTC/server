const root = "/catalog/young-events";
const sharedFilters = [
  "search",
  "active",
  "category",
  "module",
  "activityLevel",
  "organizerId",
  "timeBasis",
] as const;
export type YoungBrowseView = "events" | "calendar" | "organizers";

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

export function youngBrowseHref(url: URL, view: YoungBrowseView): string {
  const context = url.searchParams.has("returnTo")
    ? new URL(youngReturnHref(url.searchParams.get("returnTo")), url.origin)
    : url;
  const params = new URLSearchParams();
  if (view !== "organizers") {
    for (const key of sharedFilters) {
      const value = context.searchParams.get(key);
      if (
        value &&
        !(key === "search" && context.pathname.includes("/organizers"))
      )
        params.set(key, value);
    }
    if (view === "calendar") {
      for (const key of ["view", "date"]) {
        const value = context.searchParams.get(key);
        if (value) params.set(key, value);
      }
    } else if (
      context.pathname === root &&
      context.searchParams.has("dateUnknown")
    ) {
      params.set(
        "dateUnknown",
        context.searchParams.get("dateUnknown") ?? "true",
      );
    }
  }
  const path = view === "events" ? root : `${root}/${view}`;
  return params.size ? `${path}?${params}` : path;
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
