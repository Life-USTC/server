export function currentOAuthAuthorizePath(url: URL) {
  return `${url.pathname}${url.search}`;
}

export function parseOAuthScopes(scope: string | null) {
  return (scope ?? "")
    .split(" ")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseOAuthConsentForm(form: FormData) {
  const accept = String(form.get("accept") ?? "") === "true";
  const oauthQuery = String(form.get("oauthQuery") ?? "");
  const scopeSelectionEnabled =
    String(form.get("scopeSelectionEnabled") ?? "") === "true";
  let scope = String(form.get("scope") ?? "");

  if (accept && scopeSelectionEnabled) {
    const requestedScopes = parseOAuthScopes(
      new URLSearchParams(oauthQuery).get("scope"),
    );
    const selectedScopes = new Set(
      form
        .getAll("scopes")
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean),
    );
    scope = requestedScopes
      .filter((requestedScope) => selectedScopes.has(requestedScope))
      .join(" ");
  }

  return {
    accept,
    scope,
    oauthQuery,
  };
}
