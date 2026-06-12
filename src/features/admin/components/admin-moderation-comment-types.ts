export type AdminModerationComment = {
  body: string;
  createdAt: string | Date;
  id: string | number;
  moderationNote?: string | null;
  status: "active" | "softbanned" | "deleted";
  user?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
  } | null;
};

export type AdminModerationCommentsCopy = {
  actions: string;
  author: string;
  content: string;
  createdAt: string;
  manageComment: string;
  moderationNote: string;
  noComments: string;
  postedIn: string;
  status: string;
};

export type AdminModerationCommentRowCopy = Pick<
  AdminModerationCommentsCopy,
  "manageComment" | "moderationNote"
>;

export type AdminModerationCommentFormatter = (
  comment: AdminModerationComment,
) => string;

export type AdminModerationCommentStatusFormatter = (
  status: AdminModerationComment["status"],
) => string;
