import { afterEach, describe, expect, it, vi } from "vitest";

describe("env validation", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("throws for invalid production environment variables", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("AUTH_SECRET", "");

    const { loadEnv } = await import("@/app-env");

    expect(() => loadEnv()).toThrow("Invalid environment variables");
  });

  it("throws for invalid test environment variables", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("AUTH_SECRET", "");

    const { loadEnv } = await import("@/app-env");

    expect(() => loadEnv()).toThrow("Invalid environment variables");
  });

  it("allows production builds to skip runtime-only secrets", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_PHASE", "phase-production-build");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("AUTH_SECRET", "");

    const { loadEnv } = await import("@/app-env");
    const loadedEnv = loadEnv();

    expect(loadedEnv.NODE_ENV).toBe("production");
    expect(loadedEnv.DATABASE_URL).toBeUndefined();
  });

  it("returns a typed partial environment in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("AUTH_SECRET", "");

    const { loadEnv } = await import("@/app-env");
    const loadedEnv = loadEnv();

    expect(loadedEnv.NODE_ENV).toBe("development");
    expect(loadedEnv.DATABASE_URL).toBeUndefined();
  });

  it("shares trimmed env helpers across auth/runtime call sites", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("SECOND_SECRET", " value ");

    const { getOptionalTrimmedEnv } = await import("@/app-env");

    expect(getOptionalTrimmedEnv("SECOND_SECRET")).toBe("value");
  });

  it("leaves logger-only settings out of env validation", async () => {
    const { loadEnv } = await import("@/app-env");

    expect(
      loadEnv({
        input: {
          NODE_ENV: "development",
          LOG_LEVEL: "invalid",
        },
      }),
    ).toEqual({
      NODE_ENV: "development",
    });
  });

  it("keeps storage env scoped to app-read settings", async () => {
    const { getStorageEnv } = await import("@/app-env");

    expect(
      getStorageEnv({
        S3_BUCKET: " bucket ",
        AWS_REGION: " us-east-1 ",
        AWS_ENDPOINT_URL_S3: " http://127.0.0.1:9000 ",
        AWS_ACCESS_KEY_ID: "sdk-managed",
        AWS_SECRET_ACCESS_KEY: "sdk-managed",
        AWS_SESSION_TOKEN: "sdk-managed",
      }),
    ).toEqual({
      S3_BUCKET: "bucket",
      AWS_REGION: "us-east-1",
      AWS_ENDPOINT_URL_S3: "http://127.0.0.1:9000",
    });
  });

  it("parses upload quota as an exact positive integer", async () => {
    const { getUploadEnv } = await import("@/app-env");

    expect(getUploadEnv({ UPLOAD_TOTAL_QUOTA_MB: " 2048 " })).toEqual({
      UPLOAD_TOTAL_QUOTA_MB: 2048,
    });
    expect(() => getUploadEnv({ UPLOAD_TOTAL_QUOTA_MB: "2048mb" })).toThrow(
      "Invalid upload environment variables",
    );
  });
});
