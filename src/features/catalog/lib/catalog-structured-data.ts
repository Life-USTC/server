type BreadcrumbLabels = {
  collection: string;
  home: string;
};

type StructuredDataGraph = {
  "@context": "https://schema.org";
  "@graph": Record<string, unknown>[];
};

const USTC_PROVIDER = {
  "@type": "CollegeOrUniversity",
  name: "University of Science and Technology of China",
} as const;

function breadcrumbList({
  canonicalUrl,
  entityName,
  labels,
  listPath,
}: {
  canonicalUrl: string;
  entityName: string;
  labels: BreadcrumbLabels;
  listPath: string;
}) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        item: new URL("/", canonicalUrl).href,
        name: labels.home,
        position: 1,
      },
      {
        "@type": "ListItem",
        item: new URL(listPath, canonicalUrl).href,
        name: labels.collection,
        position: 2,
      },
      {
        "@type": "ListItem",
        item: canonicalUrl,
        name: entityName,
        position: 3,
      },
    ],
  };
}

function graph(
  entity: Record<string, unknown>,
  breadcrumbs: Record<string, unknown>,
): StructuredDataGraph {
  return {
    "@context": "https://schema.org",
    "@graph": [entity, breadcrumbs],
  };
}

function addDescription(
  entity: Record<string, unknown>,
  description: string | null | undefined,
) {
  const value = description?.trim();
  return value ? { ...entity, description: value } : entity;
}

export function buildCourseStructuredData({
  canonicalUrl,
  code,
  description,
  labels,
  name,
}: {
  canonicalUrl: string;
  code: string;
  description?: string | null;
  labels: BreadcrumbLabels;
  name: string;
}) {
  const entity = addDescription(
    {
      "@id": `${canonicalUrl}#course`,
      "@type": "Course",
      courseCode: code,
      name,
      provider: USTC_PROVIDER,
      url: canonicalUrl,
    },
    description,
  );

  return graph(
    entity,
    breadcrumbList({
      canonicalUrl,
      entityName: name,
      labels,
      listPath: "/courses",
    }),
  );
}

export function buildSectionStructuredData({
  canonicalUrl,
  course,
  description,
  instructors,
  labels,
  name,
}: {
  canonicalUrl: string;
  course: { jwId: number | string; name: string };
  description?: string | null;
  instructors: Array<{ id: number | string; name: string }>;
  labels: BreadcrumbLabels;
  name: string;
}) {
  const instructor = instructors
    .filter((teacher) => teacher.name)
    .map((teacher) => ({
      "@id": `${new URL(`/teachers/${teacher.id}`, canonicalUrl).href}#person`,
      "@type": "Person",
      name: teacher.name,
      url: new URL(`/teachers/${teacher.id}`, canonicalUrl).href,
    }));
  const entity = addDescription(
    {
      "@id": `${canonicalUrl}#course-instance`,
      "@type": "CourseInstance",
      ...(instructor.length > 0 ? { instructor } : {}),
      isPartOf: {
        "@id": `${new URL(`/courses/${course.jwId}`, canonicalUrl).href}#course`,
        "@type": "Course",
        name: course.name,
        url: new URL(`/courses/${course.jwId}`, canonicalUrl).href,
      },
      name,
      url: canonicalUrl,
    },
    description,
  );

  return graph(
    entity,
    breadcrumbList({
      canonicalUrl,
      entityName: name,
      labels,
      listPath: "/sections",
    }),
  );
}

export function buildTeacherStructuredData({
  canonicalUrl,
  labels,
  name,
}: {
  canonicalUrl: string;
  labels: BreadcrumbLabels;
  name: string;
}) {
  return graph(
    {
      "@id": `${canonicalUrl}#person`,
      "@type": "Person",
      name,
      url: canonicalUrl,
    },
    breadcrumbList({
      canonicalUrl,
      entityName: name,
      labels,
      listPath: "/teachers",
    }),
  );
}

const jsonLdEscapes: Record<string, string> = {
  "&": "\\u0026",
  "<": "\\u003c",
  ">": "\\u003e",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

export function serializeStructuredData(value: StructuredDataGraph) {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (character) => jsonLdEscapes[character] ?? character,
  );
}
