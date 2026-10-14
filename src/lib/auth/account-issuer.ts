/**
 * `Account.issuer` is ours to maintain from Better Auth 1.7.7 onwards.
 *
 * 1.7.2 carried `issuer` in its own account model and derived it in
 * `oauth2/account-key`: a provider's configured `accountIssuer` when it had
 * one, else a synthetic `local:oauth:<id>`, with credential accounts getting
 * `local:<id>`. 1.7.7 dropped the field and both factory helpers, but the
 * column stays load-bearing here — `remove_sign_in_method` compares it against
 * the issuer currently configured for the provider, so an account minted under
 * a since-replaced IdP stops counting as a usable sign-in method.
 *
 * These reproduce 1.7.2's encoding exactly. Existing rows are keyed on it, so
 * the strings must not drift.
 */

function encodeAccountIssuerProviderId(providerId: string) {
  return encodeURIComponent(providerId);
}

/** Synthetic issuer for providers without one of their own. */
export function createLocalAccountIssuer(providerId: string) {
  return `local:${encodeAccountIssuerProviderId(providerId)}`;
}

/**
 * Synthetic issuer for OAuth providers without one of their own. OAuth
 * identities use a distinct namespace so a provider ID cannot collide with an
 * internal local authentication method.
 */
export function createOAuthAccountIssuer(providerId: string) {
  return `local:oauth:${encodeAccountIssuerProviderId(providerId)}`;
}

/** Google publishes a stable issuer; 1.7.2 read it off the provider config. */
export const GOOGLE_ACCOUNT_ISSUER = "https://accounts.google.com";
