export function createCommentHashScroller(input: {
  setHighlightedId: (value: string | null) => void;
  waitForDom: () => Promise<void>;
}) {
  let highlightTimer: ReturnType<typeof setTimeout> | null = null;

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
    const commentId = window.location.hash.replace(/^#comment-/, "");
    if (!commentId || commentId === window.location.hash) return;
    await input.waitForDom();
    const element = document.getElementById(`comment-${commentId}`);
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
