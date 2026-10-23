import type {
  DurableObjectNamespace,
  DurableObjectState,
  Request,
} from "@cloudflare/workers-types";
import {
  observePromotion,
  type PromotionState,
  type PromotionStore,
  registerPromotionCandidate,
  runPromotion,
} from "./production-promotion";
import {
  candidateSchema,
  type PromotionEnvironment,
  promotionEvidence,
} from "./promotion-evidence";

type Environment = PromotionEnvironment & {
  PROMOTION_TOKEN: string;
  PROMOTION_READ_TOKEN: string;
  PROMOTION_ENABLED: string;
  PROMOTION: DurableObjectNamespace;
};

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export class ProductionPromotion {
  private readonly store: PromotionStore;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Environment,
  ) {
    this.store = {
      read: async () => {
        const state = await this.state.storage.get<PromotionState>("state");
        if (!state) throw new Error("Promotion has no verified baseline.");
        return state;
      },
      update: (change) =>
        this.state.storage.transaction(async (transaction) => {
          const state = await transaction.get<PromotionState>("state");
          if (!state) throw new Error("Promotion has no verified baseline.");
          const next = change(state);
          await transaction.put("state", next.state);
          if (
            next.state.pending?.phase === "verifying" ||
            (!next.state.pending && next.state.candidates.length > 0)
          ) {
            await transaction.setAlarm(
              Date.now() + (next.state.pending ? 60_000 : 1_000),
            );
          }
          return next.result;
        }),
    };
  }

  private async reconcile() {
    if (this.env.PROMOTION_ENABLED !== "true") return { status: "disabled" };
    try {
      return await runPromotion({
        store: this.store,
        ...promotionEvidence(this.env),
        operationId: () => crypto.randomUUID(),
      });
    } finally {
      const state = await this.store.read();
      if (
        state.pending?.phase === "verifying" ||
        (!state.pending && state.candidates.length > 0)
      ) {
        await this.state.storage.setAlarm(Date.now() + 60_000);
      }
    }
  }

  async alarm() {
    await this.reconcile();
  }

  async fetch(request: Request) {
    const path = new URL(request.url).pathname;
    if (path === "/status" && request.method === "GET") {
      return json(
        await observePromotion({
          store: this.store,
          readEvidence: promotionEvidence(this.env).readEvidence,
          enabled: this.env.PROMOTION_ENABLED === "true",
        }),
      );
    }
    if (path === "/state" && request.method === "GET") {
      return json(
        (await this.state.storage.get<PromotionState>("state")) ?? null,
      );
    }
    if (request.method !== "POST")
      return json({ error: "Unsupported method." }, 405);
    if (path === "/reconcile") return json(await this.reconcile());
    if (path !== "/initialize" && path !== "/candidates")
      return json({ error: "Unknown endpoint." }, 404);
    const parsed = candidateSchema.safeParse(await request.json());
    if (!parsed.success)
      return json({ error: "Invalid commit/version candidate." }, 400);
    const candidate = parsed.data;
    const evidence = promotionEvidence(this.env);
    if (path === "/initialize") {
      if (await this.state.storage.get("state"))
        return json({ error: "Baseline already initialized." }, 409);
      await evidence.verifyBaseline(candidate);
      const initialized = await this.state.storage.transaction(
        async (transaction) => {
          if (await transaction.get("state")) return false;
          await transaction.put("state", {
            delivered: candidate,
            candidates: [],
            pending: null,
          } satisfies PromotionState);
          return true;
        },
      );
      return json({ initialized }, initialized ? 201 : 409);
    }
    await evidence.verifyRegistration(candidate);
    await registerPromotionCandidate(this.store, candidate);
    return json({ accepted: true }, 202);
  }
}

export default {
  async fetch(request: Request, env: Environment) {
    if (
      env.PROMOTION_TOKEN?.length >= 32 &&
      env.PROMOTION_READ_TOKEN === env.PROMOTION_TOKEN
    ) {
      return json(
        { error: "Promotion credentials require separate values." },
        503,
      );
    }
    const authorization = request.headers.get("authorization");
    const writer =
      env.PROMOTION_TOKEN?.length >= 32 &&
      authorization === `Bearer ${env.PROMOTION_TOKEN}`;
    const observer =
      env.PROMOTION_READ_TOKEN?.length >= 32 &&
      env.PROMOTION_READ_TOKEN !== env.PROMOTION_TOKEN &&
      authorization === `Bearer ${env.PROMOTION_READ_TOKEN}` &&
      request.method === "GET" &&
      new URL(request.url).pathname === "/status";
    if (!writer && !observer) {
      return json({ error: "Unauthorized." }, 401);
    }
    try {
      const owner = env.PROMOTION.get(env.PROMOTION.idFromName("production"));
      return await owner.fetch(request);
    } catch {
      // Do not expose upstream response bodies, request headers or credentials.
      return json(
        { error: "Promotion could not establish safe evidence." },
        503,
      );
    }
  },
};
