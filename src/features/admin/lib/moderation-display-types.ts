export type ModerationTab =
  | "comments"
  | "descriptions"
  | "homeworks"
  | "suspensions";

export type ModerationCopy = Record<string, string>;

export type ModerationCommentLike = {
  id: string | number;
  authorName?: string | null;
  body: string;
  createdAt: string | Date;
  status: "active" | "softbanned" | "deleted";
  moderationNote?: string | null;
  user?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
  } | null;
  course?: { jwId?: number | null; code: string; nameCn: string } | null;
  section?: {
    jwId?: number | null;
    code: string;
    course?: { nameCn: string } | null;
  } | null;
  teacher?: { id?: number | null; nameCn: string } | null;
  homework?: { id?: string | null; title: string } | null;
  sectionTeacher?: {
    section?: {
      jwId?: number | null;
      code: string | null;
      course?: { nameCn: string } | null;
    } | null;
    teacher?: { nameCn: string } | null;
  } | null;
};

export type ModerationDescriptionLike = {
  content?: string | null;
  lastEditedAt?: string | Date | null;
  updatedAt: string | Date;
  course?: { jwId?: number | null; code: string; nameCn: string } | null;
  section?: {
    jwId?: number | null;
    code: string;
    course?: { nameCn: string } | null;
  } | null;
  teacher?: { id?: number | null; nameCn: string } | null;
  homework?: {
    id?: string | null;
    title: string;
    section?: { jwId?: number | null } | null;
  } | null;
  sectionTeacher?: null;
};
