import { jsonResponse, notFound } from "@/lib/api/helpers";

export async function getSectionDetailAction(parsedJwId: number) {
  const { findSectionDetailByJwId } = await import(
    "@/lib/course-section-queries"
  );
  const section = await findSectionDetailByJwId(parsedJwId, "zh-cn");

  if (!section) {
    return notFound("Section not found");
  }

  return jsonResponse(section);
}
