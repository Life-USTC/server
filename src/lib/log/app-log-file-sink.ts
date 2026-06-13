type NodeFileSystem = {
  appendFileSync: (path: string, data: string) => void;
  mkdirSync: (path: string, options: { recursive: boolean }) => void;
};

function getNodeFileSystem() {
  return typeof process.getBuiltinModule === "function"
    ? (process.getBuiltinModule("fs") as NodeFileSystem)
    : null;
}

function joinLogPath(directory: string, filename: string) {
  return `${directory.replace(/\/+$/, "")}/${filename}`;
}

export function writeLogFileLine(payload: Record<string, unknown>) {
  const logDir = process.env.APP_LOG_DIR?.trim();
  if (!logDir) return;

  const fs = getNodeFileSystem();
  if (!fs) return;

  const date = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(
    joinLogPath(logDir, `app-${date}.jsonl`),
    `${JSON.stringify(payload)}\n`,
  );
}
