import type { getPrismaClient } from "@/lib/admin-page-auth";

export type AdminModerationPrisma = Awaited<ReturnType<typeof getPrismaClient>>;

export type AdminModerationDateValue = Date | string | null;

export type AdminModerationCommentRecord = {
  authorName?: string | null;
  body: string;
  course?: { code: string; jwId?: number | null; nameCn: string } | null;
  createdAt: AdminModerationDateValue;
  homework?: { id?: string | null; title: string } | null;
  id: string | number;
  isAnonymous?: boolean | null;
  moderationNote?: string | null;
  section?: {
    code: string;
    course?: { nameCn: string } | null;
    jwId?: number | null;
  } | null;
  sectionTeacher?: {
    section?: {
      code: string | null;
      course?: { nameCn: string } | null;
      jwId?: number | null;
    } | null;
    teacher?: { nameCn: string } | null;
  } | null;
  status: "active" | "softbanned" | "deleted";
  teacher?: { id?: number | null; nameCn: string } | null;
  user?: { id: string; name?: string | null; username?: string | null } | null;
  userId?: string | null;
};

export type AdminModerationDescriptionRecord = {
  content?: string | null;
  course?: { code: string; jwId?: number | null; nameCn: string } | null;
  homework?: {
    id?: string | null;
    section?: { jwId?: number | null } | null;
    title: string;
  } | null;
  id: string | number;
  lastEditedAt: AdminModerationDateValue;
  lastEditedBy?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
  } | null;
  section?: {
    code: string;
    course?: { nameCn: string } | null;
    jwId?: number | null;
  } | null;
  teacher?: { id?: number | null; nameCn: string } | null;
  updatedAt: AdminModerationDateValue;
};

export type AdminModerationHomeworkRecord = {
  createdAt: AdminModerationDateValue;
  createdBy?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
  } | null;
  deletedAt: AdminModerationDateValue;
  deletedBy?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
  } | null;
  id: string;
  section: {
    code: string;
    course: { code?: string | null; jwId?: number | null; nameCn: string };
    jwId?: number | null;
  };
  submissionDueAt: AdminModerationDateValue;
  title: string;
};

export type AdminModerationSuspensionRecord = {
  createdAt: AdminModerationDateValue;
  expiresAt: AdminModerationDateValue;
  id: string;
  liftedAt: AdminModerationDateValue;
  note?: string | null;
  reason?: string | null;
  user: {
    id: string;
    name?: string | null;
    username?: string | null;
  };
};
