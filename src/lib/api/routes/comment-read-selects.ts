export const commentThreadInclude = {
  user: {
    select: {
      id: true,
      name: true,
      image: true,
      isAdmin: true,
      accounts: {
        select: {
          provider: true,
        },
      },
    },
  },
  attachments: {
    include: {
      upload: {
        select: {
          filename: true,
          contentType: true,
          size: true,
        },
      },
    },
  },
  reactions: {
    select: {
      type: true,
      userId: true,
    },
  },
} as const;

export const commentTargetLookupSelect = {
  sectionId: true,
  courseId: true,
  teacherId: true,
  sectionTeacherId: true,
  rootId: true,
  id: true,
  homework: {
    select: {
      id: true,
      title: true,
      section: {
        select: { jwId: true, code: true },
      },
    },
  },
  sectionTeacher: {
    select: {
      sectionId: true,
      teacherId: true,
      section: {
        select: {
          jwId: true,
          code: true,
          course: {
            select: { jwId: true, nameCn: true },
          },
        },
      },
      teacher: {
        select: { nameCn: true },
      },
    },
  },
  section: {
    select: { jwId: true, code: true },
  },
  course: {
    select: { jwId: true, nameCn: true },
  },
  teacher: {
    select: { nameCn: true },
  },
} as const;
