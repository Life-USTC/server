import { afterAll, describe, expect, it } from "vitest";
import { PUBLICATION_INGESTION_PRINCIPAL_KEY } from "@/lib/auth/service-principal";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const testPrisma = createFixturePrisma();

describe("publication ingestion service principal", () => {
  afterAll(async () => {
    await disconnectTestPrisma(testPrisma);
  });

  it("keeps a stable non-user ownership key", () => {
    expect(PUBLICATION_INGESTION_PRINCIPAL_KEY).toBe(
      "service:publication-crawler",
    );
  });

  it("does not provision the obsolete OAuth crawler client", async () => {
    const client = await testPrisma.oAuthClient.findUnique({
      where: { clientId: "life-ustc-publication-crawler" },
      select: { clientId: true },
    });

    expect(client).toBeNull();
  });
});
