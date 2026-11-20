import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, expect, it } from "vitest";

let directory: string;
const payload = Buffer.from("SQLite format 3\0fixture");
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "snapshot-download-test-"));
  writeFileSync(join(directory, "raw"), payload);
  writeFileSync(join(directory, "compressed"), gzipSync(payload));
  writeFileSync(
    join(directory, "bun"),
    '#!/bin/sh\ncp "$STATIC_SNAPSHOT_PATH" "$FIXTURE/result"\n',
    { mode: 0o755 },
  );
  writeFileSync(
    join(directory, "curl"),
    `#!/bin/sh
while [ "$1" != --output ]; do shift; done
file=$2
url=$3
echo "$url" >> "$FIXTURE/requests"
case "$url" in
  *.gz)
    if [ "$HTTP_STATUS" != 200 ]; then echo "$HTTP_STATUS"; exit 22; fi
    cp "$FIXTURE/compressed" "$file" ;;
  *) cp "$FIXTURE/raw" "$file" ;;
esac
echo 200
`,
    { mode: 0o755 },
  );
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function load(settings: Record<string, string>) {
  execFileSync("sh", ["scripts/load-static-sqlite.sh"], {
    env: {
      PATH: `${directory}:${process.env.PATH}`,
      DATABASE_URL: "local-test",
      FIXTURE: directory,
      HTTP_STATUS: "200",
      ...settings,
    },
    stdio: "pipe",
  });
  expect(readFileSync(join(directory, "result"))).toEqual(payload);
}

it("decompresses a full download and accepts a local raw file", () => {
  load({});
  expect(readFileSync(join(directory, "requests"), "utf8").trim()).toMatch(
    /\.sqlite\.gz$/,
  );
  load({ STATIC_SNAPSHOT_PATH: join(directory, "raw") });
});

it("uses the old raw URL only when the default compressed resource is absent", () => {
  load({ HTTP_STATUS: "404" });
  expect(
    readFileSync(join(directory, "requests"), "utf8").trim().split("\n"),
  ).toHaveLength(2);
  expect(() => load({ HTTP_STATUS: "503" })).toThrow();
  expect(() =>
    load({
      HTTP_STATUS: "404",
      STATIC_SNAPSHOT_URL: "https://example.test/override.gz",
    }),
  ).toThrow();
});

it("rejects a truncated gzip before invoking the importer", () => {
  const path = join(directory, "truncated");
  writeFileSync(path, gzipSync(payload).subarray(0, -6));
  expect(() => load({ STATIC_SNAPSHOT_PATH: path })).toThrow();
  expect(() => readFileSync(join(directory, "result"))).toThrow();
});
