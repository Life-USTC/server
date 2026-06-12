import {
  fetchDescriptionPayload,
  saveDescriptionPayload,
} from "./description-card-client";
import type {
  DescriptionCopy,
  DescriptionData,
  DescriptionHistoryItem,
  DescriptionTargetType,
  DescriptionViewer,
  EditorSummary,
} from "./description-card-types";

export function createDescriptionCardActions(input: {
  getCopy: () => DescriptionCopy;
  getDescription: () => DescriptionData;
  getDraft: () => string;
  getTargetId: () => number | string;
  getTargetType: () => DescriptionTargetType;
  setDescription: (value: DescriptionData) => void;
  setDraft: (value: string) => void;
  setEditing: (value: boolean) => void;
  setHistory: (value: DescriptionHistoryItem[]) => void;
  setMessage: (value: string) => void;
  setSaving: (value: boolean) => void;
  setViewer: (value: DescriptionViewer) => void;
}) {
  function startEdit() {
    input.setDraft(input.getDescription().content);
    input.setEditing(true);
    input.setMessage("");
  }

  function cancelEdit() {
    input.setEditing(false);
    input.setDraft("");
    input.setMessage("");
  }

  function editorName(editor: EditorSummary | null | undefined) {
    return editor?.name ?? editor?.username ?? input.getCopy().editorUnknown;
  }

  async function reloadDescription() {
    const result = await fetchDescriptionPayload({
      targetId: input.getTargetId(),
      targetType: input.getTargetType(),
    });
    if (!result.ok || !result.payload) {
      input.setMessage(input.getCopy().loadFailed);
      return;
    }
    input.setDescription(result.payload.description);
    input.setHistory(result.payload.history ?? []);
    input.setViewer(result.payload.viewer);
  }

  async function saveDescription() {
    input.setSaving(true);
    input.setMessage("");
    try {
      const response = await saveDescriptionPayload({
        targetType: input.getTargetType(),
        targetId: input.getTargetId(),
        content: input.getDraft().trim(),
      });
      if (!response.ok) {
        input.setMessage(input.getCopy().updateError);
        return;
      }
      input.setEditing(false);
      input.setDraft("");
      await reloadDescription();
    } finally {
      input.setSaving(false);
    }
  }

  return {
    cancelEdit,
    editorName,
    reloadDescription,
    saveDescription,
    startEdit,
  };
}
