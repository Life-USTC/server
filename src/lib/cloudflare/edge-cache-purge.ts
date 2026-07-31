const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

export async function purgeCloudflareCacheByTags(tags: readonly string[]) {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!zoneId || !apiToken || tags.length === 0) {
    return { ok: false, skipped: true as const };
  }

  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/zones/${zoneId}/purge_cache`,
    {
      body: JSON.stringify({ tags: [...tags] }),
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Cloudflare cache purge failed (${response.status}): ${body}`,
    );
  }

  return { ok: true, skipped: false as const };
}
