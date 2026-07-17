type CourseJwIdLookupClient = {
  course: {
    findMany(args: {
      where: {
        OR: [{ jwId: number }, { aliases: { some: { jwId: number } } }];
      };
      select: {
        id: true;
        jwId: true;
        aliases: {
          where: { jwId: number };
          select: { jwId: true };
        };
      };
    }): PromiseLike<
      Array<{ id: number; jwId: number; aliases: Array<{ jwId: number }> }>
    >;
  };
};

export async function resolveCourseIdByJwId(
  prisma: CourseJwIdLookupClient,
  jwId: number,
) {
  const matches = await prisma.course.findMany({
    where: {
      OR: [{ jwId }, { aliases: { some: { jwId } } }],
    },
    select: {
      id: true,
      jwId: true,
      aliases: {
        where: { jwId },
        select: { jwId: true },
      },
    },
  });
  const course = matches.find((match) => match.jwId === jwId);
  const alias = matches.find((match) => match.aliases.length > 0);
  if (course != null && alias != null) {
    throw new Error(
      `Course jwId namespace collision: ${jwId} is both a Course and CourseAlias`,
    );
  }
  return course?.id ?? alias?.id ?? null;
}
