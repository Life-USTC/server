import { sectionViewerPath } from "@/lib/navigation/internal-routes";
import type { SectionDetailPageData } from "./section-detail-controller-types";

export type SectionPersonalData = Pick<
  SectionDetailPageData,
  "viewer" | "homeworkData"
>;

export async function fetchSectionPersonalData(input: {
  jwId: number | string;
  focusedHomeworkId: string | null;
  signal: AbortSignal;
}): Promise<SectionPersonalData> {
  const params = new URLSearchParams();
  if (input.focusedHomeworkId)
    params.set("homeworkId", input.focusedHomeworkId);
  const response = await fetch(`${sectionViewerPath(input.jwId)}?${params}`, {
    cache: "no-store",
    credentials: "same-origin",
    signal: input.signal,
  });
  if (!response.ok) throw new Error("Failed to load section viewer");
  return (await response.json()) as SectionPersonalData;
}
