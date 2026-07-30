import { renderSocialCard } from "@/lib/server/social-card-renderer";
import { socialCardOptionsFromSearchParams } from "@/lib/social-card";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ fetch, url }) =>
  renderSocialCard(socialCardOptionsFromSearchParams(url.searchParams), fetch);
