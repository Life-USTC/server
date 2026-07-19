const ANALYTICS_SCRIPT_SOURCES = [
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://static.cloudflareinsights.com/beacon.min.js",
];

const ANALYTICS_CONNECT_SOURCES = [
  "https://www.google-analytics.com",
  "https://www.googletagmanager.com",
  "https://analytics.google.com",
];

const EXTERNAL_IMAGE_SOURCES = [
  "https://www.google-analytics.com",
  "https://www.googletagmanager.com",
  "https://avatars.githubusercontent.com",
  "https://*.googleusercontent.com",
  "https://api.dicebear.com",
];

const LOOPBACK_FORM_ACTION_SOURCES = [
  "http://localhost:*",
  "http://127.0.0.1:*",
];

export function createScriptNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const value = String.fromCharCode(...bytes);
  return btoa(value);
}

function isLoopbackHttpRedirect(url: URL) {
  return (
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  );
}

export function formActionSourceFromOAuthRedirectUri(
  redirectUri: string | null,
) {
  if (!redirectUri) return undefined;

  try {
    const url = new URL(redirectUri);
    if (url.protocol === "https:" || isLoopbackHttpRedirect(url)) {
      return url.origin;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function buildContentSecurityPolicy(
  nonce: string,
  options: { formActionSources?: string[]; isDevelopment?: boolean } = {},
) {
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    ...ANALYTICS_SCRIPT_SOURCES,
  ];

  if (options.isDevelopment) {
    scriptSources.push("'unsafe-eval'");
  }

  const connectSources = [...ANALYTICS_CONNECT_SOURCES];
  const formActionSources = Array.from(
    new Set([
      "'self'",
      ...LOOPBACK_FORM_ACTION_SOURCES,
      ...(options.formActionSources ?? []),
    ]),
  );

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: ${EXTERNAL_IMAGE_SOURCES.join(" ")}`,
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' ${connectSources.join(" ")}`,
    "frame-ancestors 'none'",
    `form-action ${formActionSources.join(" ")}`,
    "base-uri 'self'",
    "object-src 'none'",
  ];

  return directives.join("; ");
}
