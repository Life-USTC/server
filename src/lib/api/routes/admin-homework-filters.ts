import { ilike } from "./admin-shared";

export const adminHomeworkInclude = {
  section: {
    select: {
      id: true,
      jwId: true,
      code: true,
      course: { select: { jwId: true, code: true, nameCn: true } },
    },
  },
  createdBy: {
    select: { id: true, name: true, username: true, image: true },
  },
  updatedBy: {
    select: { id: true, name: true, username: true, image: true },
  },
  deletedBy: {
    select: { id: true, name: true, username: true, image: true },
  },
} as const;

export function buildAdminHomeworkWhere(input: {
  search: string;
  status: string;
}) {
  return {
    ...adminHomeworkDeletedAtWhere(input.status),
    ...adminHomeworkSearchWhere(input.search),
  };
}

function adminHomeworkDeletedAtWhere(status: string) {
  return status === "active"
    ? { deletedAt: null }
    : status === "deleted"
      ? { deletedAt: { not: null } }
      : {};
}

function adminHomeworkSearchWhere(search: string) {
  return search
    ? {
        OR: [
          { title: ilike(search) },
          { section: { code: ilike(search) } },
          { section: { course: { code: ilike(search) } } },
          { section: { course: { nameCn: ilike(search) } } },
        ],
      }
    : {};
}
