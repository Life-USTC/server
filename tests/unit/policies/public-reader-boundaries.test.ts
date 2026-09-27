import { Project, SyntaxKind } from "ts-morph";
import { expect, it } from "vitest";

// Resolving the repository's real type graph under coverage takes longer than
// a small unit test; this budget does not constrain any application request.
it("rendering-and-cache.contributor-notes-1", { timeout: 15_000 }, () => {
  const project = new Project({
    tsConfigFilePath: "tsconfig.typecheck.json",
    skipAddingFilesFromTsConfig: true,
  });
  const publicReaders: Record<string, string[]> = {
    "catalog/server/course-page-data.ts": ["getCoursePage"],
    "catalog/server/teacher-page-data.ts": ["getTeacherPage"],
    "catalog/server/course-summary-read-model.ts": ["listCourseSummaries"],
    "catalog/server/teacher-summary-read-model.ts": [
      "listTeacherSummaries",
      "findTeacherDetailById",
    ],
    "catalog/server/section-summary-read-model.ts": [
      "listSectionSummaries",
      "listSections",
    ],
    "catalog/server/academic-metadata-read-model.ts": [
      "getAcademicMetadata",
      "listSemesters",
    ],
    "section-detail/server/section-page-data.ts": ["getSectionPage"],
    "catalog-links/server/catalog-link-data.ts": ["getPublicCatalogLinksData"],
    "bus/server/bus-timetable-data.ts": ["getStaticBusTimetableData"],
    "young/server/young-event-service.ts": [
      "getYoungEvent",
      "listYoungEvents",
      "getYoungSourceFreshness",
    ],
    "young/server/young-organizer-service.ts": [
      "getYoungOrganizer",
      "listYoungOrganizers",
      "listYoungOrganizerOptions",
    ],
  };
  const forbidden = new Set([
    "userId",
    "viewer",
    "authUser",
    "authInfo",
    "session",
    "preferences",
  ]);
  // Build one type-checker program after loading every inspected source. Adding
  // files between parameter queries repeatedly invalidates ts-morph's program.
  const personalReaders = [
    [
      "section-detail/server/section-personal-data.ts",
      "getSectionPersonalData",
    ],
    [
      "catalog-links/server/catalog-link-data.ts",
      "getSignedInCatalogLinksData",
    ],
    ["bus/server/bus-timetable-data.ts", "getBusTimetableData"],
    ["young/server/young-subscription-service.ts", "getYoungEventSubscription"],
    [
      "young/server/young-subscription-service.ts",
      "getYoungOrganizerSubscription",
    ],
  ];
  for (const file of new Set([
    ...Object.keys(publicReaders),
    ...personalReaders.map(([file]) => file),
  ]))
    project.addSourceFileAtPath(`src/features/${file}`);
  for (const [file, names] of Object.entries(publicReaders)) {
    const source = project.getSourceFileOrThrow(`src/features/${file}`);
    for (const name of names) {
      const reader = source.getFunctionOrThrow(name);
      expect(reader.isExported(), name).toBe(true);
      for (const parameter of reader.getParameters()) {
        expect(forbidden.has(parameter.getName()), name).toBe(false);
        const type = parameter.getType();
        expect(type.isAny() || type.isUnknown(), name).toBe(false);
        for (const field of type.getNonNullableType().getProperties())
          expect(
            forbidden.has(field.getName()),
            `${name}.${field.getName()}`,
          ).toBe(false);
      }
      for (const call of reader.getDescendantsOfKind(SyntaxKind.CallExpression))
        expect(call.getExpression().getText(), name).not.toMatch(
          /^(?:getSectionPersonalData|getSignedInCatalogLinksData|getBusPreference|getYoungEventSubscription|getYoungOrganizerSubscription|withUserDbContext|resolveSessionUserId|getUserId)$/,
        );
    }
  }
  for (const [file, name] of personalReaders) {
    const reader = project
      .getSourceFileOrThrow(`src/features/${file}`)
      .getFunctionOrThrow(name);
    expect(
      reader
        .getParameters()
        .some(
          (parameter) =>
            parameter.getName() === "userId" ||
            parameter.getType().getNonNullableType().getProperty("userId") !=
              null,
        ),
      name,
    ).toBe(true);
  }
});
