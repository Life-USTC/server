type PinnableDashboardLink = {
  isPinned: boolean;
  slug: string;
};

export function currentDashboardLinkReturnTo() {
  const url = new URL(window.location.href);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function applyDashboardLinkPinnedSlugs<
  Link extends PinnableDashboardLink,
>(links: Link[], pinnedSlugs: string[]) {
  const pinnedSlugSet = new Set(pinnedSlugs);
  return links.map((link) => ({
    ...link,
    isPinned: pinnedSlugSet.has(link.slug),
  }));
}

export async function submitDashboardLinkPinRequest(input: {
  action: "pin" | "unpin";
  fallbackMessage: string;
  returnTo: string;
  slug: string;
}) {
  const formData = new FormData();
  formData.set("slug", input.slug);
  formData.set("action", input.action);
  formData.set("returnTo", input.returnTo);

  const response = await fetch("/api/dashboard-links/pin", {
    method: "POST",
    body: formData,
    headers: { accept: "application/json" },
  });
  const payload = (await response.json()) as {
    error?: string | null;
    pinnedSlugs?: string[];
  };

  if (!response.ok) {
    throw new Error(payload.error ?? input.fallbackMessage);
  }

  return payload.pinnedSlugs ?? [];
}
