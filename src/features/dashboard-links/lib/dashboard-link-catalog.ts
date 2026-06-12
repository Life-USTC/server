export type DashboardLinkCategory =
  | "academic"
  | "community"
  | "services"
  | "campus";

export type DashboardLinkIcon =
  | "book-open"
  | "clipboard-list"
  | "building"
  | "graduation-cap"
  | "mail"
  | "monitor-play"
  | "network"
  | "school"
  | "users";

export type DashboardLinkItem = {
  slug: string;
  title: string;
  url: string;
  description: string;
  category: DashboardLinkCategory;
  icon: DashboardLinkIcon;
};

export type DashboardLinkGroup =
  | "mostClicked"
  | "study"
  | "life"
  | "tech"
  | "classroom"
  | "external"
  | "graduate"
  | "leastClicked";

export { USTC_DASHBOARD_LINKS } from "@/features/dashboard-links/lib/dashboard-link-catalog-data";

export const DASHBOARD_LINK_GROUP_ORDER: DashboardLinkGroup[] = [
  "mostClicked",
  "study",
  "life",
  "tech",
  "classroom",
  "external",
  "graduate",
  "leastClicked",
];

export const DASHBOARD_LINK_GROUPS: Record<DashboardLinkGroup, string[]> = {
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
    "legacy-jw",
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
    "history-culture",
    "bbs",
    "confession-wall",
    "campus-portal",
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
  ],
  classroom: ["classroom-2", "classroom-3", "classroom-5"],
  external: ["zhihu", "bilibili", "weibo"],
  graduate: ["grad-service-platform", "epc-platform", "gradschool"],
  leastClicked: [
    "study-guidance",
    "campus-wiki",
    "hpc-center",
    "payment-system",
    "hospital",
    "transcript-verify",
    "welcome",
    "admissions-office",
    "equipment-repair",
  ],
};
