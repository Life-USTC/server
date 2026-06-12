export type CommentAuthor = {
  id?: string;
  name: string | null;
  image?: string | null;
  isUstcVerified: boolean;
  isAdmin: boolean;
  isGuest: boolean;
};

export type CommentAttachment = {
  id: string;
  uploadId: string;
  filename: string;
  url: string;
  contentType: string | null;
  size: number;
};

export type CommentReaction = {
  type: string;
  count: number;
  viewerHasReacted: boolean;
};

export type CommentNode = {
  id: string;
  body: string;
  visibility: string;
  status: string;
  author: CommentAuthor | null;
  authorHidden: boolean;
  isAnonymous: boolean;
  isAuthor: boolean;
  createdAt: string;
  updatedAt: string;
  parentId: string | null;
  rootId: string | null;
  replies: CommentNode[];
  attachments: CommentAttachment[];
  reactions: CommentReaction[];
  canReply: boolean;
  canEdit: boolean;
  canModerate: boolean;
};

export type CommentViewer = {
  userId: string | null;
  name: string | null;
  image: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  suspensionExpiresAt: string | null;
};

export type CommentTarget = {
  type: "section" | "course" | "teacher" | "section-teacher" | "homework";
  targetId?: number | null;
  sectionId?: number | null;
  teacherId?: number | null;
  sectionTeacherId?: number | null;
  homeworkId?: string | null;
};
