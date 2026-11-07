import * as z from "zod";
import { PUBLICATION_SOURCE_ORGANIZATION_LEVELS } from "./publication-source-level-values";

export type { PublicationSourceOrganizationLevel } from "./publication-source-level-values";
export {
  isPublicationSourceOrganizationLevel,
  PUBLICATION_SOURCE_ORGANIZATION_LEVELS,
  PUBLICATION_SOURCE_UNIVERSITY_LEVEL,
  PUBLICATION_SOURCE_UNKNOWN_LEVEL,
  parsePublicationSourceOrganizationLevel,
} from "./publication-source-level-values";

export const publicationSourceOrganizationLevelSchema = z.enum(
  PUBLICATION_SOURCE_ORGANIZATION_LEVELS,
);
