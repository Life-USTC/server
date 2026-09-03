import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
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
});
