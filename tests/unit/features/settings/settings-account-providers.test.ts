import { describe, expect, it } from "vitest";
import { buildSettingsAccountProviders } from "@/features/settings/server/settings-account-providers";

describe("buildSettingsAccountProviders", () => {
  it("attaches collected USTC identities only to the linked OIDC provider", () => {
    const ustcIdentities = {
      upstreamUids: ["435", "812"],
      records: [
        {
          upstreamUid: "435",
          gid: "gid-435",
          sno: "BA435",
          firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
          lastSyncedAt: new Date("2026-01-02T00:00:00.000Z"),
        },
        {
          upstreamUid: "812",
          gid: "gid-812",
          sno: "BA812",
          firstSeenAt: new Date("2026-01-03T00:00:00.000Z"),
          lastSyncedAt: new Date("2026-01-04T00:00:00.000Z"),
        },
      ],
    };

    const providers = buildSettingsAccountProviders(
      [
        {
          id: "acc-oidc",
          provider: "oidc",
          providerAccountId: "812",
        },
      ],
      ustcIdentities,
    );

    expect(
      providers.find((provider) => provider.id === "oidc")?.ustcIdentities,
    ).toEqual(ustcIdentities);
    expect(
      providers.find((provider) => provider.id === "github")?.ustcIdentities,
    ).toBeNull();
  });
});
