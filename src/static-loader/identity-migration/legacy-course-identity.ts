import { createHash } from "node:crypto";

const SYNTHETIC_JWID_BASE = 1_500_000_000;
const SYNTHETIC_JWID_SPAN = 400_000_000;

export function isLegacySyntheticCourseJwId(jwId: number) {
  return (
    jwId >= SYNTHETIC_JWID_BASE &&
    jwId < SYNTHETIC_JWID_BASE + SYNTHETIC_JWID_SPAN
  );
}

export function legacySemanticCourseJwId(sourceKey: string): number {
  const digest = createHash("sha256")
    .update(`course-variant:v1:${sourceKey}`)
    .digest("hex");
  return (
    SYNTHETIC_JWID_BASE +
    (Number.parseInt(digest.slice(0, 8), 16) % SYNTHETIC_JWID_SPAN)
  );
}

export function legacyCodeCourseJwId(code: string): number {
  const digest = createHash("sha256").update(`course:${code}`).digest("hex");
  return (
    SYNTHETIC_JWID_BASE +
    (Number.parseInt(digest.slice(0, 8), 16) % SYNTHETIC_JWID_SPAN)
  );
}
