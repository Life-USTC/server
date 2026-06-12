export {
  applyDashboardLinkPinnedSlugs,
  currentDashboardLinkReturnTo,
  submitDashboardLinkPinRequest,
} from "./dashboard-link-pin-client";
export {
  type DashboardLinkSearchable,
  groupDashboardLinks,
  linkMatchesTokens,
  searchQueryToTokens,
} from "./dashboard-link-search";

type DashboardLinkLike = {
  icon:
    | "book-open"
    | "building"
    | "clipboard-list"
    | "graduation-cap"
    | "mail"
    | "monitor-play"
    | "network"
    | "school"
    | "users";
};

export function linkIconLabel(icon: unknown) {
  const labels: Record<DashboardLinkLike["icon"], string> = {
    "book-open": "BK",
    building: "BD",
    "clipboard-list": "CL",
    "graduation-cap": "GR",
    mail: "ML",
    "monitor-play": "MP",
    network: "NW",
    school: "SC",
    users: "US",
  };
  return typeof icon === "string" && icon in labels
    ? labels[icon as DashboardLinkLike["icon"]]
    : "LK";
}
