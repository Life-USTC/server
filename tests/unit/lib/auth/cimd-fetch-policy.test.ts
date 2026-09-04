import { resolve4, resolve6 } from "node:dns/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  allowCimdMetadataFetch,
  fetchCimdMetadataResource,
} from "@/lib/auth/cimd-fetch-policy";

vi.mock("node:dns/promises", () => ({
  resolve4: vi.fn(),
  resolve6: vi.fn(),
}));

const resolve4Mock = vi.mocked(resolve4);
const resolve6Mock = vi.mocked(resolve6);

describe("CIMD metadata fetch policy", () => {
  beforeEach(() => {
    resolve4Mock.mockReset();
    resolve6Mock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adapts redirect rejection to the mode supported by Workers", async () => {
    const response = new Response(null, { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;

    await expect(
      fetchCimdMetadataResource("https://client.example/oauth.json", {
        headers: { accept: "application/json" },
        redirect: "error",
        signal,
      }),
    ).resolves.toBe(response);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://client.example/oauth.json",
      {
        headers: { accept: "application/json" },
        redirect: "manual",
        signal,
      },
    );
  });

  it("accepts hostnames only when every resolved address is public", async () => {
    resolve4Mock.mockResolvedValue(["203.0.113.10"]);
    resolve6Mock.mockResolvedValue(["2606:4700:4700::1111"]);

    await expect(
      allowCimdMetadataFetch("https://client.example/oauth.json"),
    ).resolves.toBe(false);

    resolve4Mock.mockResolvedValue(["8.8.8.8"]);

    await expect(
      allowCimdMetadataFetch("https://client.example/oauth.json"),
    ).resolves.toBe(true);
  });

  it("rejects a hostname when either address family resolves privately", async () => {
    resolve4Mock.mockResolvedValue(["8.8.8.8"]);
    resolve6Mock.mockResolvedValue(["fd00::1"]);

    await expect(
      allowCimdMetadataFetch("https://client.example/oauth.json"),
    ).resolves.toBe(false);
  });

  it("allows one public address family when the other has no records", async () => {
    resolve4Mock.mockResolvedValue(["8.8.4.4"]);
    resolve6Mock.mockRejectedValue(
      Object.assign(new Error("no data"), { code: "ENODATA" }),
    );

    await expect(
      allowCimdMetadataFetch("https://client.example/oauth.json"),
    ).resolves.toBe(true);
  });

  it("rejects reserved literals and DNS failures", async () => {
    await expect(
      allowCimdMetadataFetch("https://127.0.0.1/oauth.json"),
    ).resolves.toBe(false);
    expect(resolve4Mock).not.toHaveBeenCalled();

    resolve4Mock.mockRejectedValue(new Error("resolver unavailable"));
    resolve6Mock.mockResolvedValue([]);
    await expect(
      allowCimdMetadataFetch("https://client.example/oauth.json"),
    ).resolves.toBe(false);
  });
});
