import { USTC_CAMPUS_COMMUNITY_LINKS } from "./dashboard-link-catalog-campus-community";
import { USTC_ESSENTIAL_LINKS } from "./dashboard-link-catalog-essential";
import { USTC_GRADUATE_AND_SUPPORT_LINKS } from "./dashboard-link-catalog-graduate-support";
import { USTC_STUDENT_SERVICE_LINKS } from "./dashboard-link-catalog-student-services";

/**
 * Curated from https://github.com/SmartHypercube/ustclife (CC BY-SA 4.0).
 *
 * Chunks are concatenated in recommendation order. Keep that order stable unless
 * the product recommendation priority intentionally changes.
 */
export const USTC_DASHBOARD_LINKS = [
  ...USTC_ESSENTIAL_LINKS,
  ...USTC_STUDENT_SERVICE_LINKS,
  ...USTC_CAMPUS_COMMUNITY_LINKS,
  ...USTC_GRADUATE_AND_SUPPORT_LINKS,
];
