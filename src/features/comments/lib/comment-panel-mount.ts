export function mountCommentPanel({
  clearHashScroller,
  hasInitialData,
  loadComments,
  scrollToHashComment,
  waitForDom,
}: {
  clearHashScroller: () => void;
  hasInitialData: boolean;
  loadComments: () => Promise<unknown>;
  scrollToHashComment: () => Promise<unknown> | unknown;
  waitForDom: () => Promise<unknown>;
}) {
  let active = true;
  const handleHashChange = () => {
    void scrollToHashComment();
  };

  if (hasInitialData) {
    void waitForDom().then(() => {
      if (active) void scrollToHashComment();
    });
  } else {
    void loadComments().then(() => {
      if (active) void scrollToHashComment();
    });
  }
  window.addEventListener("hashchange", handleHashChange);

  return () => {
    active = false;
    window.removeEventListener("hashchange", handleHashChange);
    clearHashScroller();
  };
}
