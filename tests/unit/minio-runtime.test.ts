import {
  resolveMinioAwsRegion,
  resolveMinioConsolePort,
  resolveMinioContainerName,
  resolveMinioCredentials,
  resolveMinioPort,
} from "@tools/dev/util/minio-runtime";
import { describe, expect, it } from "vitest";

describe("minio runtime", () => {
  it("ignores blank and placeholder configured values", () => {
    expect(resolveMinioContainerName({ MINIO_CONTAINER_NAME: "  " })).toBe(
      "life-ustc-minio-dev",
    );
    expect(resolveMinioAwsRegion({ AWS_REGION: "replace-with-region" })).toBe(
      "us-east-1",
    );
    expect(resolveMinioAwsRegion({ AWS_REGION: " eu-central-1 " })).toBe(
      "eu-central-1",
    );
    expect(
      resolveMinioCredentials({ AWS_ACCESS_KEY_ID: " your-access-key " })
        .accessKeyId,
    ).toBe("minioadmin");
  });

  it("resolves only the documented MinIO container env name", () => {
    expect(resolveMinioContainerName({})).toBe("life-ustc-minio-dev");
    expect(
      resolveMinioContainerName({ MINIO_CONTAINER_NAME: " custom " }),
    ).toBe("custom");
  });

  it("uses exact bounded port env values", () => {
    expect(resolveMinioPort({ MINIO_PORT: " 9100 " })).toBe("9100");
    expect(resolveMinioConsolePort({ MINIO_CONSOLE_PORT: " 9101 " })).toBe(
      "9101",
    );
    expect(resolveMinioPort({ MINIO_PORT: "9000/api" })).toBe("9000");
    expect(resolveMinioConsolePort({ MINIO_CONSOLE_PORT: "70000" })).toBe(
      "9001",
    );
  });
});
