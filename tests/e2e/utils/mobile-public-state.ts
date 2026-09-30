import type { APIRequestContext } from "@playwright/test";
import { arrangeBusTimetable } from "../../shared/bus-timetable";
import type { TestPrismaClient } from "../../shared/prisma";
import {
  arrangeSearchCourse,
  arrangeSearchSection,
  arrangeSearchTeacher,
} from "./catalog-search-fixture";
import { DEV_SEED } from "./dev-seed";
import { arrangeWeatherCache } from "./weather-cache-fixture";

/** Arrange only the public domain read by this mobile route, in its private Worker. */
export async function arrangeMobilePublicState(
  db: TestPrismaClient,
  request: APIRequestContext,
  origin: string,
  path: string,
) {
  if (path.startsWith("/catalog/bus")) {
    await arrangeBusTimetable(db);
  } else if (path === "/catalog/weather") {
    await arrangeWeatherCache(request);
  } else {
    await db.$transaction(async (tx) => {
      if (path.startsWith("/catalog/courses")) {
        await arrangeSearchCourse(tx);
      } else if (path.startsWith("/catalog/sections")) {
        const course = await arrangeSearchCourse(tx);
        const teacher = await arrangeSearchTeacher(tx);
        await arrangeSearchSection(tx, course, teacher);
      } else if (path.startsWith("/catalog/teachers")) {
        await arrangeSearchTeacher(tx);
      } else if (path.startsWith("/catalog/young-events")) {
        const organizer = await tx.youngOrganizer.create({
          data: {
            id: "dev-scenario-young-organizer",
            name: DEV_SEED.youngEvent.organizer,
            normalizedName: DEV_SEED.youngEvent.organizer,
          },
        });
        await tx.youngEvent.create({
          data: {
            youngId: DEV_SEED.youngEvent.youngId,
            name: DEV_SEED.youngEvent.name,
            category: DEV_SEED.youngEvent.category,
            location: DEV_SEED.youngEvent.location,
            organizer: organizer.name,
            organizerId: organizer.id,
            isActive: true,
            startAt: new Date(Date.now() + 86_400_000),
            endAt: new Date(Date.now() + 90_000_000),
            rawJson: {},
          },
        });
      } else if (path === `/community/users/${DEV_SEED.debugUsername}`) {
        await tx.user.create({
          data: {
            name: DEV_SEED.debugName,
            username: DEV_SEED.debugUsername,
            email: "mobile-public-profile@example.test",
            emailVerified: true,
            image: new URL("/images/icon.png", origin).href,
          },
        });
      }
    });
  }
}
