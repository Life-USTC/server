export type AdminModerationPendingServerAction =
  | "description"
  | "deleteHomework"
  | "liftSuspension"
  | null;

export function createAdminModerationControllerDefaultState<
  Comment,
  Description,
  Homework,
>(input: { search: string }) {
  return {
    _commentStatus: "active" as "active" | "softbanned" | "deleted",
    _customExpiresAt: "",
    _descriptionDraft: "",
    _dialogMessage: "",
    _isRefreshingQueue: false,
    _isSavingComment: false,
    _isSuspendingUser: false,
    _moderationNote: "",
    _pendingDeleteHomework: null as Homework | null,
    _pendingServerAction: null as AdminModerationPendingServerAction,
    _refreshError: "",
    _searchQuery: input.search,
    _selectedComment: null as Comment | null,
    _selectedDescription: null as Description | null,
    _suspensionDuration: "7d",
    _suspensionReason: "",
  };
}
