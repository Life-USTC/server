import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { expect, it } from "vitest";

it("loads compressed and legacy snapshots and rejects failures outside the default fallback", () => {
  const directory = mkdtempSync(join(tmpdir(), "snapshot-download-test-"));
  const payload = Buffer.from("SQLite format 3\0fixture");
  try {
    writeFileSync(join(directory, "raw"), payload);
    writeFileSync(join(directory, "gzip"), gzipSync(payload));
    writeFileSync(
      join(directory, "bun"),
      '#!/bin/sh\ncp "$STATIC_SNAPSHOT_PATH" "$FIXTURE/result"\n',
      { mode: 0o755 },
    );
    writeFileSync(
      join(directory, "curl"),
      `#!/bin/sh
while [ "$1" != --output ]; do shift; done
case "$3" in
  *.gz)
    if [ "$HTTP_STATUS" != 200 ]; then echo "$HTTP_STATUS"; exit 22; fi
    cp "$FIXTURE/gzip" "$2" ;;
  *) cp "$FIXTURE/raw" "$2" ;;
esac
echo 200
`,
      { mode: 0o755 },
    );

    function load(settings: Record<string, string>) {
      execFileSync("sh", ["scripts/load-static-sqlite.sh"], {
        env: {
          PATH: `${directory}:${process.env.PATH}`,
          DATABASE_URL: "test",
          FIXTURE: directory,
          HTTP_STATUS: "200",
          ...settings,
        },
      });
      expect(readFileSync(join(directory, "result"))).toEqual(payload);
    }

    load({});
    load({ HTTP_STATUS: "404" });
    load({ STATIC_SNAPSHOT_PATH: join(directory, "raw") });
    expect(() => load({ HTTP_STATUS: "503" })).toThrow();
    expect(() =>
      load({
        HTTP_STATUS: "404",
        STATIC_SNAPSHOT_URL: "https://example.test/override.gz",
      }),
    ).toThrow();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
