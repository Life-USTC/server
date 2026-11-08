import { demoNewsContentHash, demoNewsImageBytes } from "./demo-news-assets";

export const DEMO_YOUNG_POSTER_PATH = "demo-young-poster.png";
/** The same code-generated, visibly fictional raster; never an upstream poster. */
export function getDemoYoungPoster(path: string) {
  if (path !== DEMO_YOUNG_POSTER_PATH) return null;
  const bytes = demoNewsImageBytes();
  return {
    bytes,
    contentType: "image/png",
    sha256: demoNewsContentHash(bytes),
  };
}
