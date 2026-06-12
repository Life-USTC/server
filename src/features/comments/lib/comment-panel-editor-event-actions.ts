import type { ViewerContext } from "@/lib/auth/viewer-context";

export function createCommentPanelEditorEventActions(input: {
  getViewer: () => ViewerContext;
  setDragActive: (value: boolean) => void;
  submitComment: () => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
}) {
  function handleEditorDrop(event: DragEvent) {
    event.preventDefault();
    input.setDragActive(false);
    const viewer = input.getViewer();
    if (!viewer.isAuthenticated || viewer.isSuspended) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) void input.uploadFile(file);
  }

  function handleSubmitShortcut(event: KeyboardEvent) {
    const viewer = input.getViewer();
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key === "Enter" &&
      viewer.isAuthenticated &&
      !viewer.isSuspended
    ) {
      event.preventDefault();
      void input.submitComment();
    }
  }

  return {
    handleEditorDrop,
    handleSubmitShortcut,
  };
}
