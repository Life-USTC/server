import { withE2ePrisma } from "./prisma";

export type TempCoursesFixtureOptions = {
  count: number;
  nameCn?: string;
  nameEn?: string;
  prefix: string;
};

export async function createTempCoursesFixture(
  options: TempCoursesFixtureOptions,
) {
  return await withE2ePrisma(async (prisma) => {
    await prisma.course.deleteMany({
      where: { code: { startsWith: options.prefix } },
    });

    const aggregate = await prisma.course.aggregate({
      _max: { jwId: true },
    });
    const firstJwId = Math.max(1_500_000_000, (aggregate._max.jwId ?? 0) + 1);

    await prisma.course.createMany({
      data: Array.from({ length: options.count }, (_, index) => ({
        code: `${options.prefix}-${String(index).padStart(2, "0")}`,
        jwId: firstJwId + index,
        nameCn: `${options.nameCn ?? options.prefix}-${String(index).padStart(2, "0")}`,
        nameEn: options.nameEn,
      })),
    });

    return { count: options.count };
  });
}

export async function deleteTempCoursesByPrefix(prefix: string) {
  await withE2ePrisma((prisma) =>
    prisma.course.deleteMany({
      where: { code: { startsWith: prefix } },
    }),
  );
}
