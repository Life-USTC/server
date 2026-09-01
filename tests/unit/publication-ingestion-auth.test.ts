import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import {
  PUBLICATION_INGESTION_SECRET_HEADER,
  requirePublicationIngestionPrincipal,
  timingSafeSecretEqual,
} from "@/lib/auth/publication-ingestion-auth";
import { PUBLICATION_INGESTION_PRINCIPAL_KEY } from "@/lib/auth/service-principal";

const request = (secret?: string) =>
  new Request("https://life.example/api/ingestion/publications/batches", {
    method: "POST",
    headers: secret
      ? { [PUBLICATION_INGESTION_SECRET_HEADER]: secret }
      : undefined,
  });

describe("publication ingestion service authentication", () => {
  beforeEach(() => setCloudflareRuntimeEnv(undefined));
  afterEach(() => {
    setCloudflareRuntimeEnv(undefined);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("compares equal and unequal secrets through fixed-size digests", async () => {
    await expect(timingSafeSecretEqual("expected", "expected")).resolves.toBe(
      true,
    );
    await expect(timingSafeSecretEqual("wrong", "expected")).resolves.toBe(
      false,
    );
    await expect(
      timingSafeSecretEqual("expected-with-suffix", "expected"),
    ).resolves.toBe(false);
  });

  it.each([undefined, "wrong-secret"])(
    "returns the same generic 401 for missing or invalid credentials (%s)",
    async (secret) => {
      vi.stubEnv("PUBLICATION_INGESTION_SECRET", "expected-secret");

      const response = await requirePublicationIngestionPrincipal(
        request(secret),
      );

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(401);
      await expect((response as Response).json()).resolves.toEqual({
        error: "Unauthorized",
      });
      expect(JSON.stringify(response)).not.toContain("expected-secret");
      expect(JSON.stringify(response)).not.toContain("wrong-secret");
    },
  );

  it("does not accept WEBHOOK_SECRET as a substitute", async () => {
    vi.stubEnv("WEBHOOK_SECRET", "expected-secret");

    const response = await requirePublicationIngestionPrincipal(
      request("expected-secret"),
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(401);
  });

  it("does not accept an OAuth bearer token", async () => {
    vi.stubEnv("PUBLICATION_INGESTION_SECRET", "expected-secret");

    const response = await requirePublicationIngestionPrincipal(
      new Request("https://life.example/api/ingestion/publications/batches", {
        headers: { Authorization: "Bearer expected-secret" },
      }),
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(401);
  });

  it("returns the stable service principal without consulting a User row", async () => {
    vi.stubEnv("PUBLICATION_INGESTION_SECRET", "expected-secret");

    await expect(
      requirePublicationIngestionPrincipal(request("expected-secret")),
    ).resolves.toEqual({
      kind: "service",
      serviceId: "publication-crawler",
      principalKey: PUBLICATION_INGESTION_PRINCIPAL_KEY,
    });
  });

  it("rate-limits the stable service key after authentication", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    setCloudflareRuntimeEnv({ USER_BATCH_WRITE_RATE_LIMITER: { limit } });
    vi.stubEnv("PUBLICATION_INGESTION_SECRET", "expected-secret");

    await expect(
      requirePublicationIngestionPrincipal(request("expected-secret")),
    ).resolves.toMatchObject({ kind: "service" });
    expect(limit).toHaveBeenCalledWith({
      key: JSON.stringify([
        "user-mutation:v1",
        "life.example",
        "publication:ingest:write",
        PUBLICATION_INGESTION_PRINCIPAL_KEY,
      ]),
    });
  });

  it("fails closed when the service rate limiter is unavailable", async () => {
    vi.stubEnv("PUBLICATION_INGESTION_SECRET", "expected-secret");
    setCloudflareRuntimeEnv({});

    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await requirePublicationIngestionPrincipal(
      request("expected-secret"),
    );

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(503);
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls.flat().map(String).join(" ")).not.toContain(
      "expected-secret",
    );
  });
});
