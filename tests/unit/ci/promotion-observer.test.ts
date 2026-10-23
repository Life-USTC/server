import { describe, expect, it, vi } from "vitest";
import type { PromotionObservation } from "../../../scripts/deploy/production-promotion";
import {
  readPromotionObservation,
  watchPromotionOrdering,
} from "../../../scripts/deploy/promotion-observer";

const commit = "a".repeat(40);
const options = { pollSeconds: 1, settleSeconds: 2, deadlineSeconds: 6 };

function ports(
  observation: PromotionObservation = { status: "settled", commit },
) {
  let clock = 0;
  return {
    readObservation: vi.fn(async () => observation),
    readLiveVersion: vi.fn(async (): Promise<string | null> => commit),
    sleep: vi.fn(async (seconds: number) => {
      clock += seconds * 1_000;
    }),
    now: () => clock,
  };
}

describe("read-only promotion ordering observer", () => {
  it("requires two settled observations and the independent live marker", async () => {
    const dependencies = ports();
    expect(await watchPromotionOrdering(dependencies, options)).toEqual({
      status: "verified",
      commit,
    });
    expect(dependencies.readObservation).toHaveBeenCalledTimes(2);
    expect(dependencies.readLiveVersion).toHaveBeenCalledTimes(2);
    expect(dependencies.sleep).toHaveBeenCalledWith(2);
  });

  it("waits for a ready candidate to finish before confirming delivery", async () => {
    const dependencies = ports();
    dependencies.readObservation.mockResolvedValueOnce({
      status: "pending",
      commit,
    });
    expect(await watchPromotionOrdering(dependencies, options)).toEqual({
      status: "verified",
      commit,
    });
    expect(dependencies.readObservation).toHaveBeenCalledTimes(3);
  });

  it("fails closed for a disabled owner", async () => {
    const dependencies = ports({ status: "disabled", commit });
    expect(await watchPromotionOrdering(dependencies, options)).toMatchObject({
      status: "inconclusive",
      reason: expect.stringContaining("disabled"),
    });
    expect(dependencies.readObservation).toHaveBeenCalledTimes(1);
  });

  it("allows an in-flight publication to finish before confirming delivery", async () => {
    const dependencies = ports();
    dependencies.readObservation.mockResolvedValueOnce({
      status: "blocked",
      commit,
    });
    expect(await watchPromotionOrdering(dependencies, options)).toEqual({
      status: "verified",
      commit,
    });
    expect(dependencies.readObservation).toHaveBeenCalledTimes(3);
  });

  it("reports an unresolved publication when observation reaches its deadline", async () => {
    const dependencies = ports({ status: "blocked", commit });
    expect(await watchPromotionOrdering(dependencies, options)).toMatchObject({
      status: "inconclusive",
      reason: expect.stringContaining("unresolved publication"),
    });
    expect(dependencies.now()).toBe(options.deadlineSeconds * 1_000);
    expect(dependencies.readObservation).toHaveBeenCalledTimes(6);
  });

  it("does not equate owner state with the independently served version", async () => {
    const dependencies = ports();
    dependencies.readLiveVersion.mockResolvedValue("b".repeat(40));
    expect(await watchPromotionOrdering(dependencies, options)).toMatchObject({
      status: "inconclusive",
    });
  });

  it("retries failed observations without issuing a write", async () => {
    const dependencies = ports();
    dependencies.readObservation.mockRejectedValueOnce(
      new Error("temporary read failure"),
    );
    expect(await watchPromotionOrdering(dependencies, options)).toEqual({
      status: "verified",
      commit,
    });
    expect(dependencies.readObservation).toHaveBeenCalledTimes(3);
  });

  it("uses only the authenticated status GET and refuses credential redirects", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ status: "settled", commit }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await readPromotionObservation(
        "https://owner.example",
        "read-only-secret",
      ),
    ).toEqual({ status: "settled", commit });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://owner.example/status",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: { authorization: "Bearer read-only-secret" },
        redirect: "manual",
      }),
    );
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://other.example" },
      }),
    );
    await expect(
      readPromotionObservation("https://owner.example", "read-only-secret"),
    ).rejects.toThrow("HTTP 302");
  });
});
