type RedirectClient = {
  applicationType: string | null;
  redirectUris: readonly string[];
};

/** RFC 8252 permits port variance only for native IP loopback callbacks. */
export function isRegisteredOAuthRedirectUri(
  client: RedirectClient,
  requested: string,
) {
  if (client.redirectUris.includes(requested)) return true;
  if (client.applicationType !== "native") return false;
  try {
    const target = new URL(requested);
    if (
      target.protocol !== "http:" ||
      !["127.0.0.1", "[::1]"].includes(target.hostname) ||
      target.username ||
      target.password ||
      target.hash
    )
      return false;
    return client.redirectUris.some((registered) => {
      const entry = new URL(registered);
      return (
        entry.protocol === target.protocol &&
        entry.hostname === target.hostname &&
        entry.pathname === target.pathname &&
        entry.search === target.search &&
        !entry.username &&
        !entry.password &&
        !entry.hash
      );
    });
  } catch {
    return false;
  }
}
