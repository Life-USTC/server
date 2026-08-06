const USERS_LOCAL_SUFFIX = "@users.local";

/**
 * Better Auth requires a unique User.email. When upstream OIDC does not expose
 * a real mailbox we store `oidc-<id>@users.local` (or historical passport
 * `fake_email` placeholders). Those must not be returned to OAuth clients.
 */
export function isPlaceholderUserEmail(email: string | null | undefined) {
  if (typeof email !== "string") return true;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.endsWith(USERS_LOCAL_SUFFIX)) return true;
  if (normalized.startsWith("fakegid+")) return true;
  if (/^fake[a-z0-9._+-]*@/i.test(normalized)) return true;
  return false;
}

export function isPublishableUserEmail(email: string | null | undefined) {
  return (
    typeof email === "string" &&
    email.trim().length > 0 &&
    !isPlaceholderUserEmail(email)
  );
}
