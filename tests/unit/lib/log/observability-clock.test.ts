import { describe, expect, it, vi } from "vitest";
import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";

describe("observability clock", () => {
  it("uses a monotonic source and clamps invalid elapsed values", () => {
    const now = vi.spyOn(performance, "now");
    now.mockReturnValueOnce(100).mockReturnValueOnce(125);

    const start = monotonicNowMs();
    expect(elapsedMs(start)).toBe(25);

    now.mockReturnValueOnce(10).mockReturnValueOnce(Number.NaN);
    const backwards = monotonicNowMs();
    expect(elapsedMs(backwards)).toBe(0);
  });
});
