import { afterEach, describe, expect, it, vi } from "vitest";
import { createCommentHashScroller } from "@/features/comments/lib/comment-panel-hash-scroll";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("comment hash hydration", () => {
  it("hydrates one missing permalink thread and scrolls after it renders", async () => {
    const scrollIntoView = vi.fn();
    let element: { scrollIntoView: () => void } | null = null;
    const loadMissingComment = vi.fn(async (commentId: string) => {
      expect(commentId).toBe("reply-21");
      element = { scrollIntoView };
    });
    const setHighlightedId = vi.fn();
    const waitForDom = vi.fn(async () => {});
    vi.stubGlobal("window", { location: { hash: "#comment-reply-21" } });
    vi.stubGlobal("document", {
      getElementById: vi.fn(() => element),
    });

    const scroller = createCommentHashScroller({
      loadMissingComment,
      setHighlightedId,
      waitForDom,
    });

    await Promise.all([
      scroller.scrollToHashComment(),
      scroller.scrollToHashComment(),
    ]);

    expect(loadMissingComment).toHaveBeenCalledOnce();
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    expect(setHighlightedId).toHaveBeenCalledWith("reply-21");
    scroller.clear();
  });

  it("does not hydrate a permalink that is already in the DOM", async () => {
    const scrollIntoView = vi.fn();
    const loadMissingComment = vi.fn();
    vi.stubGlobal("window", { location: { hash: "#comment-root-2" } });
    vi.stubGlobal("document", {
      getElementById: vi.fn(() => ({ scrollIntoView })),
    });

    const scroller = createCommentHashScroller({
      loadMissingComment,
      setHighlightedId: vi.fn(),
      waitForDom: vi.fn(async () => {}),
    });

    await scroller.scrollToHashComment();

    expect(loadMissingComment).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledOnce();
    scroller.clear();
  });
});
