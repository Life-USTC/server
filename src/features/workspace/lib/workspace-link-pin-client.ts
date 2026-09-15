import { apiFetch, readApiErrorMessage } from "@/lib/api/client";

type PinnableCatalogLink = {
  isPinned: boolean;
  slug: string;
};

export function currentCatalogLinkReturnTo() {
  const url = new URL(window.location.href);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function applyCatalogLinkPinnedSlugs<Link extends PinnableCatalogLink>(
  links: Link[],
  pinnedSlugs: string[],
) {
  const pinnedSlugSet = new Set(pinnedSlugs);
  return links.map((link) => ({
    ...link,
    isPinned: pinnedSlugSet.has(link.slug),
  }));
}

export async function submitWorkspaceLinkPinRequest(input: {
  action: "pin" | "unpin";
  fallbackMessage: string;
  returnTo: string;
  slug: string;
}) {
  const formData = new FormData();
  formData.set("slug", input.slug);
  formData.set("action", input.action);
  formData.set("returnTo", input.returnTo);

  const response = await apiFetch("/api/workspace/link-pins", {
    method: "POST",
    body: formData,
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, input.fallbackMessage));
  }

  const payload = (await response.json()) as {
    error?: string | null;
    pinnedSlugs?: string[];
  };

  return payload.pinnedSlugs ?? [];
}
