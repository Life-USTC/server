import { afterEach, describe, expect, it } from "vitest";
import { setCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import { getPrisma } from "@/lib/db/prisma";

const HYPERDRIVE_ENV = (connectionString: string) => ({
  HYPERDRIVE: { connectionString },
});

describe("getPrisma in the Cloudflare runtime", () => {
  afterEach(() => setCloudflareRuntimeEnv(undefined));

  it("reuses the extended client across requests in the same isolate", () => {
    setCloudflareRuntimeEnv(
      HYPERDRIVE_ENV("postgresql://u:p@db.example:5432/a"),
    );

    const first = getPrisma("zh-cn");
    const second = getPrisma("zh-cn");

    expect(second).toBe(first);
  });

  it("keeps one extended client per locale", () => {
    setCloudflareRuntimeEnv(
      HYPERDRIVE_ENV("postgresql://u:p@db.example:5432/a"),
    );

    const zh = getPrisma("zh-cn");
    const en = getPrisma("en");

    expect(en).not.toBe(zh);
    expect(getPrisma("en")).toBe(en);
  });

  it("rebuilds the client when the connection string changes", () => {
    setCloudflareRuntimeEnv(
      HYPERDRIVE_ENV("postgresql://u:p@db.example:5432/a"),
    );
    const before = getPrisma("zh-cn");

    setCloudflareRuntimeEnv(
      HYPERDRIVE_ENV("postgresql://u:p@db.example:5432/b"),
    );

    expect(getPrisma("zh-cn")).not.toBe(before);
  });
});
