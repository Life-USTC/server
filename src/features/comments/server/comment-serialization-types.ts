import type {
  CommentReactionType,
  CommentStatus,
  CommentVisibility,
} from "@/generated/prisma/client";

export type CommentAuthorSummary = {
  id?: string;
  name: string | null;
  image?: string | null;
  isUstcVerified: boolean;
  isAdmin: boolean;
  isGuest: boolean;
};

export type CommentAttachmentSummary = {
  id: string;
  uploadId: string;
  filename: string;
  url: string;
  contentType: string | null;
  size: number;
};

export type CommentReactionSummary = {
  type: string;
  count: number;
  viewerHasReacted: boolean;
};

export type CommentNode = {
  id: string;
  body: string;
  visibility: CommentVisibility;
  status: CommentStatus;
  author: CommentAuthorSummary | null;
  authorHidden: boolean;
  isAnonymous: boolean;
  isAuthor: boolean;
  createdAt: string;
  updatedAt: string;
  parentId: string | null;
  rootId: string | null;
  replies: CommentNode[];
  attachments: CommentAttachmentSummary[];
  reactions: CommentReactionSummary[];
  canReply: boolean;
  canEdit: boolean;
  canModerate: boolean;
};

export type ViewerInfo = {
  userId: string | null;
  name: string | null;
  image: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
};

export type RawAccount = {
  provider: string;
};

export type RawUser = {
  id: string;
  name: string | null;
  image: string | null;
  isAdmin?: boolean;
  accounts?: RawAccount[] | null;
};

export type RawUpload = {
  filename?: string | null;
  contentType?: string | null;
  size?: number | null;
};

export type RawAttachment = {
  id: string;
  uploadId: string;
  upload?: RawUpload | null;
};

export type RawReaction = {
  type: CommentReactionType;
  userId: string | null;
};

export type RawComment = {
  id: string;
  body: string;
  visibility: CommentVisibility;
  status: CommentStatus;
  authorName?: string | null;
  isAnonymous?: boolean | null;
  userId?: string | null;
  user?: RawUser | null;
  createdAt: Date;
  updatedAt: Date;
  parentId?: string | null;
  rootId?: string | null;
  attachments?: RawAttachment[] | null;
  reactions?: RawReaction[] | null;
};
