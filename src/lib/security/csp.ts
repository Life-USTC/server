const ANALYTICS_SCRIPT_SOURCES = [
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
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

const OAUTH_CALLBACK_FORM_ACTION_SOURCES = [
  "https://chatgpt.com",
  "https://www.perplexity.ai",
];

export function createScriptNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const value = String.fromCharCode(...bytes);
  return btoa(value);
}

export function buildContentSecurityPolicy(
  nonce: string,
  options: { isDevelopment?: boolean } = {},
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

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: ${EXTERNAL_IMAGE_SOURCES.join(" ")}`,
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' ${connectSources.join(" ")}`,
    "frame-ancestors 'none'",
    `form-action 'self' ${LOOPBACK_FORM_ACTION_SOURCES.join(" ")} ${OAUTH_CALLBACK_FORM_ACTION_SOURCES.join(" ")}`,
    "base-uri 'self'",
    "object-src 'none'",
  ];

  return directives.join("; ");
}
