import { z } from "zod";
import type { OrderingWatchOptions } from "./deployment-ordering";
import type { PromotionObservation } from "./production-promotion";
import { candidateSchema } from "./promotion-evidence";

const observationSchema = z.object({
  status: z.enum(["disabled", "blocked", "pending", "settled"]),
  commit: candidateSchema.shape.commit,
});

export async function readPromotionObservation(origin: string, token: string) {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Promotion observer requires an HTTPS origin.");
  }
  const response = await fetch(new URL("/status", url), {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(`Promotion observation returned HTTP ${response.status}.`);
  return observationSchema.parse(await response.json());
}

export async function watchPromotionOrdering(
  ports: {
    readObservation(): Promise<PromotionObservation>;
    readLiveVersion(): Promise<string | null>;
    sleep(seconds: number): Promise<void>;
    now(): number;
  },
  options: OrderingWatchOptions,
): Promise<
  | { status: "verified"; commit: string }
  | { status: "inconclusive"; reason: string }
> {
  const deadline = ports.now() + options.deadlineSeconds * 1_000;
  let previous: string | null = null;
  let lastStatus: PromotionObservation["status"] | null = null;
  while (ports.now() < deadline) {
    let observation: PromotionObservation | null = null;
    let live: string | null = null;
    try {
      observation = await ports.readObservation();
      live = await ports.readLiveVersion();
    } catch {
      // Only observations are retried. This workflow has no write credential.
    }
    lastStatus = observation?.status ?? null;
    if (observation?.status === "disabled") {
      return {
        status: "inconclusive",
        reason: `the serialized promotion owner is ${observation.status}`,
      };
    }
    if (observation?.status === "settled" && live === observation.commit) {
      if (previous === live) return { status: "verified", commit: live };
      previous = live;
      await ports.sleep(options.settleSeconds);
    } else {
      previous = null;
      await ports.sleep(options.pollSeconds);
    }
  }
  return {
    status: "inconclusive",
    reason:
      lastStatus === "blocked"
        ? "the serialized promotion owner still has an unresolved publication at the deadline"
        : "serialized promotion did not settle on the independently observed live commit before the deadline",
  };
}
