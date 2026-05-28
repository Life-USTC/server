import { getS3ConnectSources } from "@/lib/storage/s3";

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

  const connectSources = [
    ...ANALYTICS_CONNECT_SOURCES,
    ...getS3ConnectSources(),
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: ${EXTERNAL_IMAGE_SOURCES.join(" ")}`,
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' ${connectSources.join(" ")}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ];

  return directives.join("; ");
}
