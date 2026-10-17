import { expect, it } from "vitest";
import {
  COLLECTION_DESKTOP_MIN_WIDTH_PX,
  collectionCompactClass,
  collectionDesktopClass,
  collectionDesktopScrollClass,
} from "@/lib/components/collection-responsive-breakpoint";

it("uses xl for catalog and workspace collection layouts", () => {
  expect(COLLECTION_DESKTOP_MIN_WIDTH_PX).toBe(1280);
  for (const classes of [
    collectionCompactClass,
    collectionDesktopClass,
    collectionDesktopScrollClass,
  ]) {
    expect(classes).toContain("xl:");
  }
});
