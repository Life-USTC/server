export function createCommentHashScroller(input: {
  loadMissingComment: (commentId: string) => Promise<void>;
  setHighlightedId: (value: string | null) => void;
  waitForDom: () => Promise<void>;
}) {
  let highlightTimer: ReturnType<typeof setTimeout> | null = null;
  const attemptedHydrations = new Set<string>();
  const hydrationPromises = new Map<string, Promise<void>>();

  function flashHighlightedComment(commentId: string) {
    input.setHighlightedId(commentId);
    if (highlightTimer) clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => {
      input.setHighlightedId(null);
      highlightTimer = null;
    }, 2000);
  }

  async function scrollToHashComment() {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const commentId = hash.replace(/^#comment-/, "");
    if (!commentId || commentId === hash) return;
    await input.waitForDom();
    if (window.location.hash !== hash) return;
    let element = document.getElementById(`comment-${commentId}`);
    if (!element) {
      let hydration = hydrationPromises.get(hash);
      if (!hydration && !attemptedHydrations.has(hash)) {
        attemptedHydrations.add(hash);
        hydration = Promise.resolve().then(() =>
          input.loadMissingComment(commentId),
        );
        hydrationPromises.set(hash, hydration);
      }
      if (hydration) {
        try {
          await hydration;
        } catch {
          return;
        }
        if (window.location.hash !== hash) return;
        await input.waitForDom();
        element = document.getElementById(`comment-${commentId}`);
      }
    }
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    flashHighlightedComment(commentId);
  }

  function clear() {
    if (highlightTimer) {
      clearTimeout(highlightTimer);
      highlightTimer = null;
    }
  }

  return {
    clear,
    scrollToHashComment,
  };
}
