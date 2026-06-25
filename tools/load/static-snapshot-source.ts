import * as fs from "node:fs";
import * as path from "node:path";

export const STATIC_SNAPSHOT_URL =
  "https://static.life-ustc.tiankaima.dev/life-ustc-static.sqlite";
export const STATIC_SNAPSHOT_FILENAME = "life-ustc-static.sqlite";

type SnapshotDownloadLogger = {
  info: (message: string) => void;
};

export function staticSnapshotPath(targetDir: string) {
  return path.join(targetDir, STATIC_SNAPSHOT_FILENAME);
}

export async function downloadStaticSnapshot(
  targetDir: string,
  logger: SnapshotDownloadLogger,
): Promise<string> {
  const snapshotPath = staticSnapshotPath(targetDir);
  fs.mkdirSync(targetDir, { recursive: true });

  logger.info(`Downloading static snapshot from ${STATIC_SNAPSHOT_URL}`);
  const response = await fetch(STATIC_SNAPSHOT_URL, {
    headers: { "user-agent": "life-ustc-static-import/1.0" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(snapshotPath, bytes);
  return snapshotPath;
}
