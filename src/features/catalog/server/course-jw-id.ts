type CourseJwIdLookupClient = {
  course: {
    findUnique(args: {
      where: { jwId: number };
      select: { id: true };
    }): PromiseLike<{ id: number } | null>;
  };
};

export async function resolveCourseIdByJwId(
  prisma: CourseJwIdLookupClient,
  jwId: number,
) {
  const course = await prisma.course.findUnique({
    where: { jwId },
    select: { id: true },
  });
  return course?.id ?? null;
}
