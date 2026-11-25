export type WorkspaceHomeworkCreateSection = {
  course?: {
    code?: string | null;
    name?: string | null;
  } | null;
  courseCode?: string | null;
  courseName?: string | null;
  id: number | string;
  nextClassStarts?: string[];
  jwId?: number | null;
  semesterEnd?: string | null;
  semesterStart?: string | null;
  semesterName?: string | null;
  teacherName?: string | null;
};
