import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("Google Analytics tag", () => {
  it("loads and configures the requested GA4 measurement exactly once", async () => {
    const appHtml = await readFile(path.join(repoRoot, "src/app.html"), "utf8");

    expect(
      appHtml.match(
        /https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-JNK35J2Q3R/g,
      ),
    ).toHaveLength(1);
    expect(
      appHtml.match(/window\.dataLayer\s*=\s*window\.dataLayer\s*\|\|\s*\[\]/g),
    ).toHaveLength(1);
    expect(appHtml.match(/gtag\("config",\s*"G-JNK35J2Q3R"\)/g)).toHaveLength(
      1,
    );
  });
});
