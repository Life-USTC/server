import type { AppLocale } from "@/i18n/config";

export type CatalogLinkCategory =
  | "academic"
  | "community"
  | "services"
  | "campus";

export type CatalogLinkIcon =
  | "book-open"
  | "clipboard-list"
  | "building"
  | "graduation-cap"
  | "mail"
  | "monitor-play"
  | "network"
  | "school"
  | "users";

export type CatalogLinkLocalizedFields = {
  title: string;
  description: string;
};

export type CatalogLinkItem = {
  slug: string;
  title: string;
  url: string;
  description: string;
  localizations: {
    "en-us": CatalogLinkLocalizedFields;
  };
  category: CatalogLinkCategory;
  icon: CatalogLinkIcon;
};

export type LocalizedCatalogLinkItem = Omit<
  CatalogLinkItem,
  "localizations"
> & {
  locale: AppLocale;
};

export type CatalogLinkGroup =
  | "mostClicked"
  | "study"
  | "life"
  | "tech"
  | "classroom"
  | "external"
  | "graduate"
  | "leastClicked";

export { USTC_CATALOG_LINKS } from "@/features/catalog-links/lib/catalog-link-catalog-data";

export function localizeCatalogLink(
  link: CatalogLinkItem,
  locale: AppLocale,
): LocalizedCatalogLinkItem {
  const { localizations, ...base } = link;
  const localized = locale === "en-us" ? localizations["en-us"] : null;

  return {
    ...base,
    locale,
    title: localized?.title ?? link.title,
    description: localized?.description ?? link.description,
  };
}

export function localizeCatalogLinks(
  links: CatalogLinkItem[],
  locale: AppLocale,
): LocalizedCatalogLinkItem[] {
  return links.map((link) => localizeCatalogLink(link, locale));
}

export const CATALOG_LINK_GROUP_ORDER: CatalogLinkGroup[] = [
  "mostClicked",
  "study",
  "life",
  "tech",
  "classroom",
  "external",
  "graduate",
  "leastClicked",
];

export const CATALOG_LINK_GROUPS: Record<CatalogLinkGroup, string[]> = {
  mostClicked: [
    "jw",
    "icourse",
    "mail",
    "library",
    "official",
    "course-platform",
    "education-office",
    "nan7",
    "network",
  ],
  study: [
    "staff-homepage",
    "faculty-homepages",
    "blackboard",
    "undergraduate-school",
    "physics-lab-1",
    "catalog-query",
    "ta-management",
    "physics-lab-2",
    "student-services",
    "ot-club",
    "study-space-booking",
    "cmet-room-booking",
    "dawu-tools",
    "physics-lab-3",
  ],
  life: [
    "bbs",
    "confession-wall",
    "campus-portal",
    "career-services",
    "network-center",
    "repair",
    "ustc-news",
    "personal-homepage",
    "rec",
    "ecard",
    "admission-rain",
    "licensed-software",
    "print-service",
    "second-classroom",
    "n7-teahouse",
    "flyer",
    "qq-proof",
    "cloud-drive",
  ],
  tech: [
    "web-vpn",
    "mirrors",
    "scc-gitlab",
    "lug-gitlab",
    "ustc-latex",
    "vlab",
    "llm-platform",
  ],
  classroom: ["classroom-2", "classroom-3", "classroom-5"],
  external: ["zhihu", "bilibili", "weibo"],
  graduate: [
    "grad-service-platform",
    "epc-platform",
    "gradschool",
    "graduate-admissions",
  ],
  leastClicked: [
    "study-guidance",
    "hpc-center",
    "hospital",
    "transcript-verify",
    "welcome",
    "admissions-office",
    "equipment-repair",
  ],
};
