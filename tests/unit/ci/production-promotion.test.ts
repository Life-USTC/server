import { describe, expect, it, vi } from "vitest";
import {
  observePromotion,
  type PromotionState,
  type PromotionStore,
  registerPromotionCandidate,
  runPromotion,
} from "../../../scripts/deploy/production-promotion";
import { createDeferred } from "../../shared/deferred";

const BASE = { commit: "1".repeat(40), version: "base-version" };
const A = { commit: "a".repeat(40), version: "a-version" };
const B = { commit: "b".repeat(40), version: "b-version" };
const C = { commit: "c".repeat(40), version: "c-version" };

function memoryStore(delivered = BASE) {
  let state: PromotionState = {
    delivered,
    candidates: [],
    pending: null,
  };
  const store: PromotionStore = {
    async read() {
      return structuredClone(state);
    },
    async update(change) {
      const next = change(structuredClone(state));
      state = structuredClone(next.state);
      return next.result;
    },
  };
  return store;
}

function ports(store: PromotionStore) {
  const readEvidence = vi.fn(async () => ({
    history: [C.commit, B.commit, A.commit, BASE.commit],
    ready: [A, B, C],
    waiting: [] as string[],
  }));
  const publish = vi.fn(async () => "deployment-id");
  const isDelivered = vi.fn(async () => true);
  return {
    store,
    readEvidence,
    publish,
    isDelivered,
    operationId: () => "operation-id",
  };
}

describe("serialized production promotion", () => {
  it("observes failed or unfinished candidate CI without treating an upload as ready", async () => {
    const store = memoryStore();
    await registerPromotionCandidate(store, A);
    const dependencies = ports(store);
    dependencies.readEvidence.mockResolvedValue({
      history: [A.commit, BASE.commit],
      ready: [],
      waiting: [],
    });
    expect(await observePromotion({ ...dependencies, enabled: true })).toEqual({
      status: "settled",
      commit: BASE.commit,
    });
    expect((await store.read()).candidates).toEqual([A]);
    expect(dependencies.publish).not.toHaveBeenCalled();
    dependencies.readEvidence.mockResolvedValue({
      history: [A.commit, BASE.commit],
      ready: [],
      waiting: [A.commit],
    });
    expect(await observePromotion({ ...dependencies, enabled: true })).toEqual({
      status: "pending",
      commit: BASE.commit,
    });
    expect(dependencies.publish).not.toHaveBeenCalled();
    dependencies.readEvidence.mockResolvedValue({
      history: [A.commit, BASE.commit],
      ready: [A],
      waiting: [],
    });
    expect(await observePromotion({ ...dependencies, enabled: true })).toEqual({
      status: "pending",
      commit: BASE.commit,
    });
    expect(dependencies.publish).not.toHaveBeenCalled();
  });

  it("does not report settled when candidates change during its read", async () => {
    const store = memoryStore();
    const dependencies = ports(store);
    dependencies.readEvidence.mockImplementation(async () => {
      await registerPromotionCandidate(store, A);
      return { history: [A.commit, BASE.commit], ready: [], waiting: [] };
    });
    expect(await observePromotion({ ...dependencies, enabled: true })).toEqual({
      status: "pending",
      commit: BASE.commit,
    });
    expect(dependencies.publish).not.toHaveBeenCalled();
  });

  it("chooses the newest ready main commit and ignores a late older build", async () => {
    const store = memoryStore();
    await registerPromotionCandidate(store, B);
    await registerPromotionCandidate(store, A);
    const dependencies = ports(store);
    expect(await runPromotion(dependencies)).toEqual({
      status: "delivered",
      candidate: B,
    });
    dependencies.readEvidence.mockResolvedValue({
      history: [C.commit, B.commit],
      ready: [],
      waiting: [],
    });
    await registerPromotionCandidate(store, A);
    expect(await runPromotion(dependencies)).toEqual({ status: "idle" });
    expect(dependencies.publish.mock.calls).toEqual([
      [{ candidate: B, operationId: "operation-id" }],
    ]);
    expect((await store.read()).delivered).toEqual(B);
    expect((await store.read()).candidates).toEqual([]);
  });

  it("drops observed obsolete candidates while retaining concurrent unobserved registrations", async () => {
    const store = memoryStore(B);
    await registerPromotionCandidate(store, A);
    const dependencies = ports(store);
    dependencies.readEvidence.mockImplementationOnce(async () => {
      await registerPromotionCandidate(store, C);
      return { history: [B.commit], ready: [], waiting: [] };
    });
    expect(await runPromotion(dependencies)).toEqual({ status: "idle" });
    expect((await store.read()).candidates).toEqual([C]);
    expect(dependencies.publish).not.toHaveBeenCalled();
    dependencies.readEvidence.mockResolvedValue({
      history: [C.commit, B.commit],
      ready: [C],
      waiting: [],
    });
    expect(await runPromotion(dependencies)).toEqual({
      status: "delivered",
      candidate: C,
    });
  });

  it("persists pending before the external write and blocks another writer", async () => {
    const store = memoryStore();
    await registerPromotionCandidate(store, A);
    const dependencies = ports(store);
    const entered = createDeferred<void>();
    const completion = createDeferred<string>();
    dependencies.publish.mockImplementation(async () => {
      expect((await store.read()).pending).toEqual({
        candidate: A,
        operationId: "operation-id",
        phase: "publishing",
      });
      entered.resolve();
      return completion.promise;
    });
    const first = runPromotion(dependencies);
    await entered.promise;
    await registerPromotionCandidate(store, B);
    const restarted = ports(store);
    expect(await runPromotion(restarted)).toEqual({ status: "blocked" });
    expect(restarted.publish).not.toHaveBeenCalled();
    completion.resolve("deployment-a");
    await first;
    expect(await runPromotion(restarted)).toEqual({
      status: "delivered",
      candidate: B,
    });
  });

  it("retains unknown write outcomes across restart without publishing again", async () => {
    const store = memoryStore();
    await registerPromotionCandidate(store, A);
    const dependencies = ports(store);
    dependencies.publish.mockRejectedValue(new Error("response was lost"));
    expect(await runPromotion(dependencies)).toEqual({ status: "blocked" });
    await registerPromotionCandidate(store, B);
    const restarted = ports(store);
    expect(await runPromotion(restarted)).toEqual({ status: "blocked" });
    expect(restarted.publish).not.toHaveBeenCalled();
    expect((await store.read()).delivered).toEqual(BASE);
    expect((await store.read()).pending?.candidate).toEqual(A);
  });

  it("keeps the newest eligible candidate when the later commit failed CI", async () => {
    const store = memoryStore();
    await registerPromotionCandidate(store, B);
    await registerPromotionCandidate(store, A);
    const dependencies = ports(store);
    dependencies.readEvidence.mockResolvedValue({
      history: [B.commit, A.commit, BASE.commit],
      ready: [A],
      waiting: [],
    });
    expect(await runPromotion(dependencies)).toEqual({
      status: "delivered",
      candidate: A,
    });
    expect((await store.read()).candidates).toEqual([B]);
  });

  it("requires readiness for the exact immutable version and commit pair", async () => {
    const store = memoryStore();
    await registerPromotionCandidate(store, A);
    const dependencies = ports(store);
    dependencies.readEvidence.mockResolvedValue({
      history: [A.commit, BASE.commit],
      ready: [{ ...A, version: "another-version" }],
      waiting: [],
    });
    expect(await runPromotion(dependencies)).toEqual({ status: "idle" });
    expect(dependencies.publish).not.toHaveBeenCalled();
    expect((await store.read()).delivered).toEqual(BASE);
  });

  it("deduplicates historical build retries and retries of an already delivered commit", async () => {
    const store = memoryStore();
    await registerPromotionCandidate(store, A);
    await registerPromotionCandidate(store, { ...A, version: "retry-version" });
    expect((await store.read()).candidates).toEqual([A]);
    const dependencies = ports(store);
    await runPromotion(dependencies);
    await registerPromotionCandidate(store, A);
    await runPromotion(dependencies);
    expect(dependencies.publish).toHaveBeenCalledTimes(1);
  });

  it("retries only verification after a confirmed write and a lost observation", async () => {
    const store = memoryStore();
    await registerPromotionCandidate(store, A);
    const dependencies = ports(store);
    dependencies.isDelivered.mockRejectedValue(new Error("unreadable marker"));
    expect(await runPromotion(dependencies)).toEqual({ status: "verifying" });
    expect((await store.read()).pending).toMatchObject({
      phase: "verifying",
      deployment: "deployment-id",
    });
    await registerPromotionCandidate(store, B);
    const restarted = ports(store);
    expect(await runPromotion(restarted)).toEqual({
      status: "delivered",
      candidate: A,
    });
    expect(restarted.publish).not.toHaveBeenCalled();
    expect((await store.read()).candidates).toEqual([B]);
  });

  it("never calls the external writer when pending storage fails", async () => {
    const store = memoryStore();
    await registerPromotionCandidate(store, A);
    const dependencies = ports({
      ...store,
      async update() {
        throw new Error("durability unavailable");
      },
    });
    await expect(runPromotion(dependencies)).rejects.toThrow(
      "durability unavailable",
    );
    expect(dependencies.publish).not.toHaveBeenCalled();
  });

  it("keeps publication pending if recording the successful response fails", async () => {
    const store = memoryStore();
    await registerPromotionCandidate(store, A);
    let writes = 0;
    const dependencies = ports({
      ...store,
      async update(change) {
        if (++writes === 2) throw new Error("process stopped after response");
        return store.update(change);
      },
    });
    expect(await runPromotion(dependencies)).toEqual({ status: "blocked" });
    const restarted = ports(store);
    expect(await runPromotion(restarted)).toEqual({ status: "blocked" });
    expect(restarted.publish).not.toHaveBeenCalled();
    expect((await store.read()).pending?.phase).toBe("publishing");
  });

  it("refuses a history snapshot that cannot establish the delivered commit", async () => {
    const store = memoryStore();
    await registerPromotionCandidate(store, A);
    const dependencies = ports(store);
    dependencies.readEvidence.mockResolvedValue({
      history: [A.commit],
      ready: [A],
      waiting: [],
    });
    await expect(runPromotion(dependencies)).rejects.toThrow(
      "outside the observed main history",
    );
    expect(dependencies.publish).not.toHaveBeenCalled();
  });
});
