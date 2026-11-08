import { createHash } from "node:crypto";

/** Original URL text identity, deliberately separate from its raster bytes. */
export const DEMO_NEWS_IMAGE_SOURCE_URL =
  "https://demo.invalid/images/fictional-demo-chart.png";
export const DEMO_NEWS_IMAGE_ID = createHash("sha256")
  .update(DEMO_NEWS_IMAGE_SOURCE_URL)
  .digest("hex");
// Deterministic 320x120 code fixture: the word DEMO and two fictional colored bars.
// No photograph, school branding, filesystem read or origin request is involved.
const IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAUAAAAB4CAIAAAAMrLyJAAABsklEQVR42u3dPQ5AMACA0Z7BZLc5hCOZXcC13EpiMLhCpT+Kl7xJpGmkn0GUsB8n8FLBJQABAwIGBAwCBgQMCBgQMAgYEDAgYBBwtH6cbikxZsz4KXPINWfLCwELGAQsYAQsYAHznYBznV9i0cdE1dpNAQQsYAQsYAEjYAELGAGnBpxyXMAIWMACRsACBgELGAGXCrjEyyECRsACFjACFjAIWMDwx4dYNecpYAQsYBCwgBGwgAWMgAUMAhYwAhawgBGwgAWMj9r5qB0IWMAIWMACRsACBj83AwQMAgYEDAgYBAwIGBAwIGAQMCBgQMCAgEHAgIABAYOAAQEDbQY8zBsVWJoIWMAIWMACRsAIGAELGAQsYASMgBEwAkbAAkbAAhYwAkbACFjAIGABI2ABCxgBI2AELGCwoR8EDAgYEDAIGBAwIGBAwCBgQMDAEwF36wLNErCAEbCAQcACBgELGAELWMAIWMAgYAGDgAWMgAUMAhYwCFjACFjAAkbAAgYBCxgELGAEbEM/IGBAwCBgQMCAgAEBg4ABAQMCBgQMAgYEDAgYBAwIGBAwIGAQMCBgIKsLNjMiXUxu64wAAAAASUVORK5CYII=";
export function demoNewsImageBytes() {
  return Uint8Array.from(atob(IMAGE_BASE64), (character) =>
    character.charCodeAt(0),
  );
}
export function demoNewsAttachmentBytes() {
  return new TextEncoder().encode(
    "DEMO ONLY — fictional reading-room checklist\n1. Bring a sample notebook.\n2. Discuss the fictional exercise.\n仅供演示：这是虚构样例清单，不是学校通知。\n",
  );
}
export function demoNewsContentHash(bytes: Uint8Array | string) {
  return createHash("sha256").update(bytes).digest("hex");
}
