export type PromotionCandidate = { commit: string; version: string };

type PendingPublication = {
  candidate: PromotionCandidate;
  operationId: string;
  phase: "publishing";
};

type PendingVerification = {
  candidate: PromotionCandidate;
  operationId: string;
  phase: "verifying";
  deployment: string;
};

export type PromotionState = {
  delivered: PromotionCandidate;
  candidates: PromotionCandidate[];
  pending: PendingPublication | PendingVerification | null;
};

/** update commits atomically and durably before its returned promise resolves. */
export type PromotionStore = {
  read(): Promise<PromotionState>;
  update<T>(
    change: (state: PromotionState) => { state: PromotionState; result: T },
  ): Promise<T>;
};

type PromotionPorts = {
  store: PromotionStore;
  readEvidence(state: PromotionState): Promise<{
    /** Main's first-parent history, newest first, through the delivered commit. */
    history: string[];
    /** Uploaded versions whose commit binding and source CI were verified. */
    ready: PromotionCandidate[];
    /** Uploaded commits whose source CI has not reached a terminal result. */
    waiting: string[];
  }>;
  publish(input: {
    candidate: PromotionCandidate;
    operationId: string;
  }): Promise<string>;
  isDelivered(pending: PendingVerification): Promise<boolean>;
  /** Unique across restarts and all publications, including manual retries. */
  operationId(): string;
};

type PromotionResult =
  | { status: "idle" | "blocked" | "verifying" }
  | { status: "delivered"; candidate: PromotionCandidate };

export type PromotionObservation = {
  status: "disabled" | "blocked" | "pending" | "settled";
  commit: string;
};

export async function observePromotion(
  ports: Pick<PromotionPorts, "store" | "readEvidence"> & { enabled: boolean },
): Promise<PromotionObservation> {
  const snapshot = await ports.store.read();
  const commit = snapshot.delivered.commit;
  if (!ports.enabled) return { status: "disabled", commit };
  if (snapshot.pending?.phase === "publishing")
    return { status: "blocked", commit };
  if (snapshot.pending) return { status: "pending", commit };
  const evidence = await ports.readEvidence(snapshot);
  const current = await ports.store.read();
  if (current.pending?.phase === "publishing")
    return { status: "blocked", commit: current.delivered.commit };
  // A read spanning another publication or newly registered candidate cannot
  // declare the owner settled using evidence collected for its earlier state.
  if (
    JSON.stringify(current) !== JSON.stringify(snapshot) ||
    evidence.ready.length > 0 ||
    evidence.waiting.length > 0
  ) {
    return { status: "pending", commit: current.delivered.commit };
  }
  return { status: "settled", commit };
}

export async function registerPromotionCandidate(
  store: PromotionStore,
  candidate: PromotionCandidate,
) {
  await store.update((state) => ({
    state:
      state.delivered.commit === candidate.commit ||
      state.candidates.some((item) => item.commit === candidate.commit)
        ? state
        : { ...state, candidates: [...state.candidates, { ...candidate }] },
    result: undefined,
  }));
}

async function verifyPublication(
  ports: PromotionPorts,
  pending: PendingVerification,
): Promise<PromotionResult> {
  try {
    if (!(await ports.isDelivered(pending))) return { status: "verifying" };
  } catch {
    // Retrying an observation is safe; the external write is never repeated.
    return { status: "verifying" };
  }
  return ports.store.update<PromotionResult>((state) => {
    if (state.pending?.operationId !== pending.operationId) {
      return { state, result: { status: "blocked" } };
    }
    return {
      state: {
        delivered: pending.candidate,
        candidates: state.candidates.filter(
          (candidate) => candidate.commit !== pending.candidate.commit,
        ),
        pending: null,
      },
      result: { status: "delivered", candidate: pending.candidate },
    };
  });
}

export async function runPromotion(
  ports: PromotionPorts,
): Promise<PromotionResult> {
  const snapshot = await ports.store.read();
  if (snapshot.pending?.phase === "publishing") return { status: "blocked" };
  if (snapshot.pending) return verifyPublication(ports, snapshot.pending);

  const evidence = await ports.readEvidence(snapshot);
  const pending = await ports.store.update<PendingPublication | null>(
    (state) => {
      if (state.pending) return { state, result: null };
      const deliveredIndex = evidence.history.indexOf(state.delivered.commit);
      if (deliveredIndex < 0) {
        throw new Error(
          "Delivered commit is outside the observed main history.",
        );
      }
      const candidates = state.candidates.filter((candidate) => {
        const index = evidence.history.indexOf(candidate.commit);
        // History stops at the delivered baseline. A registered candidate
        // already present in this snapshot but absent from that history is
        // obsolete; a candidate registered during the evidence read is not.
        return index < 0
          ? !snapshot.candidates.some(
              (observed) =>
                observed.commit === candidate.commit &&
                observed.version === candidate.version,
            )
          : index < deliveredIndex;
      });
      const commit = evidence.history
        .slice(0, deliveredIndex)
        .find((commit) =>
          candidates.some(
            (candidate) =>
              candidate.commit === commit &&
              evidence.ready.some(
                (ready) =>
                  ready.commit === commit &&
                  ready.version === candidate.version,
              ),
          ),
        );
      const candidate = candidates.find(
        (candidate) => candidate.commit === commit,
      );
      if (!candidate) {
        return { state: { ...state, candidates }, result: null };
      }
      const pending: PendingPublication = {
        candidate,
        operationId: ports.operationId(),
        phase: "publishing",
      };
      return {
        state: { ...state, candidates, pending },
        result: pending,
      };
    },
  );
  if (!pending) {
    return { status: (await ports.store.read()).pending ? "blocked" : "idle" };
  }

  let verification: PendingVerification;
  try {
    const deployment = await ports.publish({
      candidate: pending.candidate,
      operationId: pending.operationId,
    });
    verification = { ...pending, phase: "verifying", deployment };
    await ports.store.update((state) => ({
      state: { ...state, pending: verification },
      result: undefined,
    }));
  } catch {
    // The request may still take effect. A timeout or process restart must not
    // release this durable publication and allow a newer writer to pass it.
    return { status: "blocked" };
  }
  return verifyPublication(ports, verification);
}
