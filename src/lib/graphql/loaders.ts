import DataLoader from "dataloader";
import {
  findCoursesByJwIds,
  findSectionsByJwIds,
} from "@/features/catalog/server/course-section-read-queries";
import { findTeachersByIds } from "@/features/catalog/server/teacher-summary-read-model";
import type { AppLocale } from "@/i18n/config";
import { GRAPHQL_LIMITS } from "./constants";

export function createGraphqlLoaders(locale: AppLocale) {
  return {
    courseByJwId: new DataLoader(
      (jwIds: readonly number[]) => findCoursesByJwIds(jwIds, locale),
      {
        maxBatchSize: GRAPHQL_LIMITS.pageSize,
      },
    ),
    sectionByJwId: new DataLoader(
      (jwIds: readonly number[]) => findSectionsByJwIds(jwIds, locale),
      {
        maxBatchSize: GRAPHQL_LIMITS.pageSize,
      },
    ),
    teacherById: new DataLoader(
      (ids: readonly number[]) => findTeachersByIds(ids, locale),
      {
        maxBatchSize: GRAPHQL_LIMITS.pageSize,
      },
    ),
  };
}

export type GraphqlLoaders = ReturnType<typeof createGraphqlLoaders>;
