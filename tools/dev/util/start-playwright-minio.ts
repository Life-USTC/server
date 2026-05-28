import { spawnSync } from "node:child_process";
import {
  resolveMinioConsolePort,
  resolveMinioContainerName,
  resolveMinioCorsAllowOrigin,
  resolveMinioCredentials,
  resolveMinioEndpoint,
  resolveMinioImage,
  resolveMinioPort,
  waitForMinio,
} from "./minio-runtime";

function inspectRunningContainer(name: string) {
  const result = spawnSync(
    "docker",
    ["inspect", "-f", "{{.State.Running}}", name],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  );

  return result.status === 0 && result.stdout.trim() === "true";
}

function startContainer(name: string) {
  const { accessKeyId, secretAccessKey } = resolveMinioCredentials(process.env);
  const result = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--name",
      name,
      "-p",
      `${resolveMinioPort(process.env)}:9000`,
      "-p",
      `${resolveMinioConsolePort(process.env)}:9001`,
      "-e",
      `MINIO_ROOT_USER=${accessKeyId}`,
      "-e",
      `MINIO_ROOT_PASSWORD=${secretAccessKey}`,
      "-e",
      `MINIO_API_CORS_ALLOW_ORIGIN=${resolveMinioCorsAllowOrigin(process.env)}`,
      resolveMinioImage(process.env),
      "server",
      "/data",
      "--console-address",
      ":9001",
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

const containerName = resolveMinioContainerName(process.env);

if (!inspectRunningContainer(containerName)) {
  spawnSync("docker", ["rm", "-f", containerName], {
    stdio: "ignore",
  });
  startContainer(containerName);
}

try {
  await waitForMinio(resolveMinioEndpoint(process.env));
} catch (error) {
  spawnSync("docker", ["logs", containerName], { stdio: "inherit" });
  throw error;
}
