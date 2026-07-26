import type { LayoutUserSummary } from "@/lib/shell/layout-server-data";

export function layoutUserSummaryFromClientSession(
  value: unknown,
): LayoutUserSummary {
  if (!value || typeof value !== "object") return null;

  const user = value as Record<string, unknown>;
  if (typeof user.id !== "string" || !user.id) return null;

  return {
    id: user.id,
    image: typeof user.image === "string" ? user.image : null,
    isAdmin: user.isAdmin === true,
    name: typeof user.name === "string" ? user.name : null,
    username: typeof user.username === "string" ? user.username : null,
  };
}

export async function getClientViewer(
  fetcher: typeof fetch = globalThis.fetch,
): Promise<LayoutUserSummary> {
  const response = await fetcher("/api/auth/get-session", {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as { user?: unknown } | null;
  return layoutUserSummaryFromClientSession(payload?.user);
}
