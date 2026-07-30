export const SOCIAL_CARD_WIDTH = 1200;
export const SOCIAL_CARD_HEIGHT = 630;
export const SOCIAL_CARD_ENDPOINT = "/open-graph.png";

export type SocialCardVariant =
  | "course"
  | "default"
  | "profile"
  | "section"
  | "teacher";

export type SocialCardOptions = {
  avatarUrl?: string;
  footer?: string;
  label?: string;
  subtitle?: string;
  title: string;
  username?: string;
  variant?: SocialCardVariant;
};

const socialCardVariants = new Set<SocialCardVariant>([
  "course",
  "default",
  "profile",
  "section",
  "teacher",
]);

function truncate(value: string | null | undefined, maxLength: number) {
  return Array.from(value?.trim() ?? "")
    .slice(0, maxLength)
    .join("");
}

export function normalizeSocialCardOptions(
  options: SocialCardOptions,
): Required<Omit<SocialCardOptions, "avatarUrl" | "username">> &
  Pick<SocialCardOptions, "avatarUrl" | "username"> {
  return {
    avatarUrl: truncate(options.avatarUrl, 2048) || undefined,
    footer: truncate(options.footer, 60) || "life-ustc.tiankaima.dev",
    label: truncate(options.label, 40) || "LIFE@USTC",
    subtitle: truncate(options.subtitle, 120),
    title: truncate(options.title, 72) || "Life@USTC",
    username: truncate(options.username, 40) || undefined,
    variant: socialCardVariants.has(options.variant ?? "default")
      ? (options.variant ?? "default")
      : "default",
  };
}

export function socialCardOptionsFromSearchParams(
  searchParams: URLSearchParams,
): SocialCardOptions {
  const variant = searchParams.get("variant") as SocialCardVariant | null;

  return normalizeSocialCardOptions({
    avatarUrl: searchParams.get("avatar") ?? undefined,
    footer: searchParams.get("footer") ?? undefined,
    label: searchParams.get("label") ?? undefined,
    subtitle: searchParams.get("subtitle") ?? undefined,
    title: searchParams.get("title") ?? "",
    username: searchParams.get("username") ?? undefined,
    variant: variant ?? undefined,
  });
}

export function buildSocialCardPath(options: SocialCardOptions) {
  const normalized = normalizeSocialCardOptions(options);
  const searchParams = new URLSearchParams({
    footer: normalized.footer,
    label: normalized.label,
    subtitle: normalized.subtitle,
    title: normalized.title,
    variant: normalized.variant,
  });

  if (normalized.avatarUrl) {
    searchParams.set("avatar", normalized.avatarUrl);
  }
  if (normalized.username) {
    searchParams.set("username", normalized.username);
  }

  return `${SOCIAL_CARD_ENDPOINT}?${searchParams.toString()}`;
}

export function buildSocialCardUrl(origin: string, options: SocialCardOptions) {
  return new URL(buildSocialCardPath(options), origin).href;
}

export function socialCardTitle(title: string) {
  return title.replace(/\s+-\s+Life@USTC$/u, "").trim() || "Life@USTC";
}
