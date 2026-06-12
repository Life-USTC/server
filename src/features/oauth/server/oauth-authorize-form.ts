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
  return {
    accept: String(form.get("accept") ?? "") === "true",
    scope: String(form.get("scope") ?? ""),
    oauthQuery: String(form.get("oauthQuery") ?? ""),
  };
}
