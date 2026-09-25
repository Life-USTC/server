import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDescriptionCardActions } from "@/features/descriptions/lib/description-card-controller";
import { createDeferred } from "../../../shared/deferred";

const { fetchPayload, savePayload } = vi.hoisted(() => ({
  fetchPayload: vi.fn(),
  savePayload: vi.fn(),
}));
vi.mock("@/features/descriptions/lib/description-card-client", () => ({
  fetchDescriptionPayload: fetchPayload,
  saveDescriptionPayload: savePayload,
}));

function setup() {
  const session = { generation: 0, editable: true };
  const input: Parameters<typeof createDescriptionCardActions>[0] = {
    getGeneration: () => session.generation,
    canEdit: () => session.editable,
    getCopy: () => ({
      editorUnknown: "Unknown",
      loadFailed: "Load failed",
      updateError: "Save failed",
    }),
    getDescription: () => ({
      id: null,
      content: "Public text",
      renderedHtml: "Public text",
      updatedAt: null,
      lastEditedAt: null,
      lastEditedBy: null,
    }),
    getDraft: () => "Updated public text",
    getTargetId: () => 1,
    getTargetType: () => "course",
    setDescription: vi.fn(),
    setDraft: vi.fn(),
    setEditing: vi.fn(),
    setHistory: vi.fn(),
    setMessage: vi.fn(),
    setSaving: vi.fn(),
    setViewer: vi.fn(),
    onSuccess: vi.fn(),
  };
  return { session, input, actions: createDescriptionCardActions(input) };
}

beforeEach(() => vi.clearAllMocks());

describe("description editor identity changes", () => {
  it("does not open or submit while current permissions are unavailable", async () => {
    const { session, input, actions } = setup();
    session.editable = false;
    actions.startEdit();
    await actions.saveDescription();
    expect(input.setEditing).not.toHaveBeenCalled();
    expect(savePayload).not.toHaveBeenCalled();
  });

  it("discards a save response after the viewer changes", async () => {
    const pending = createDeferred<{ ok: boolean }>();
    savePayload.mockReturnValue(pending.promise);
    const { session, input, actions } = setup();
    const saving = actions.saveDescription();
    session.generation += 1;
    pending.resolve({ ok: true });
    await saving;
    expect(fetchPayload).not.toHaveBeenCalled();
    expect(input.setEditing).not.toHaveBeenCalled();
    expect(input.onSuccess).not.toHaveBeenCalled();
    expect(input.setSaving).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("discards permission refreshes belonging to a previous viewer", async () => {
    const pending = createDeferred<unknown>();
    fetchPayload.mockReturnValue(pending.promise);
    const { session, input, actions } = setup();
    const loading = actions.reloadDescription();
    session.generation += 1;
    pending.resolve({ ok: true, payload: { viewer: { userId: "previous" } } });
    await loading;
    expect(input.setViewer).not.toHaveBeenCalled();
    expect(input.setDescription).not.toHaveBeenCalled();
  });
});
