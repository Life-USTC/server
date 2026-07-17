import DataLoader from "dataloader";
import {
  findCourseDetailsByJwIds,
  findSectionDetailsByJwIds,
} from "@/features/catalog/server/course-section-read-queries";
import { findTeacherDetailsByIds } from "@/features/catalog/server/teacher-summary-read-model";
import type { AppLocale } from "@/i18n/config";
import { GRAPHQL_LIMITS } from "./constants";

export function createGraphqlLoaders(locale: AppLocale) {
  return {
    courseByJwId: new DataLoader(
      (jwIds: readonly number[]) => findCourseDetailsByJwIds(jwIds, locale),
      {
        maxBatchSize: GRAPHQL_LIMITS.pageSize,
      },
    ),
    sectionByJwId: new DataLoader(
      (jwIds: readonly number[]) => findSectionDetailsByJwIds(jwIds, locale),
      {
        maxBatchSize: GRAPHQL_LIMITS.pageSize,
      },
    ),
    teacherById: new DataLoader(
      (ids: readonly number[]) => findTeacherDetailsByIds(ids, locale),
      {
        maxBatchSize: GRAPHQL_LIMITS.pageSize,
      },
    ),
  };
}

export type GraphqlLoaders = ReturnType<typeof createGraphqlLoaders>;
