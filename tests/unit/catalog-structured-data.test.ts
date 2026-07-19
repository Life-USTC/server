import { describe, expect, test } from "vitest";
import {
  buildCourseStructuredData,
  buildSectionStructuredData,
  buildTeacherStructuredData,
  serializeStructuredData,
} from "@/features/catalog/lib/catalog-structured-data";

describe("catalog structured data", () => {
  test("builds a Chinese Course and breadcrumbs from public page fields", () => {
    const data = buildCourseStructuredData({
      canonicalUrl: "https://life.example.edu/courses/9901001",
      code: "MATH1001",
      description: "  数值方法课程简介。  ",
      labels: { collection: "课程", home: "首页" },
      name: "数值分析",
    });

    expect(data).toEqual({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@id": "https://life.example.edu/courses/9901001#course",
          "@type": "Course",
          courseCode: "MATH1001",
          description: "数值方法课程简介。",
          name: "数值分析",
          provider: {
            "@type": "CollegeOrUniversity",
            name: "University of Science and Technology of China",
          },
          url: "https://life.example.edu/courses/9901001",
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              item: "https://life.example.edu/",
              name: "首页",
              position: 1,
            },
            {
              "@type": "ListItem",
              item: "https://life.example.edu/courses",
              name: "课程",
              position: 2,
            },
            {
              "@type": "ListItem",
              item: "https://life.example.edu/courses/9901001",
              name: "数值分析",
              position: 3,
            },
          ],
        },
      ],
    });
  });

  test("builds an English CourseInstance with only public instructors", () => {
    const data = buildSectionStructuredData({
      canonicalUrl: "https://life.example.edu/sections/8802002",
      course: { jwId: 9901001, name: "Numerical Analysis" },
      instructors: [
        { id: 42, name: "Ada Lovelace" },
        { id: 43, name: "" },
      ],
      labels: { collection: "Sections", home: "Home" },
      name: "Numerical Analysis · Section 01",
    });

    expect(data["@graph"][0]).toEqual({
      "@id": "https://life.example.edu/sections/8802002#course-instance",
      "@type": "CourseInstance",
      instructor: [
        {
          "@id": "https://life.example.edu/teachers/42#person",
          "@type": "Person",
          name: "Ada Lovelace",
          url: "https://life.example.edu/teachers/42",
        },
      ],
      isPartOf: {
        "@id": "https://life.example.edu/courses/9901001#course",
        "@type": "Course",
        name: "Numerical Analysis",
        url: "https://life.example.edu/courses/9901001",
      },
      name: "Numerical Analysis · Section 01",
      url: "https://life.example.edu/sections/8802002",
    });
    expect(data["@graph"][1]).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "Home", position: 1 },
        { name: "Sections", position: 2 },
        { name: "Numerical Analysis · Section 01", position: 3 },
      ],
    });
  });

  test("keeps Person data minimal and safely serializes script-sensitive text", () => {
    const data = buildTeacherStructuredData({
      canonicalUrl: "https://life.example.edu/teachers/42",
      labels: { collection: "教师", home: "首页" },
      name: "</script><script>alert('xss')</script>&\u2028",
    });
    const serialized = serializeStructuredData(data);

    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">");
    expect(serialized).not.toContain("&");
    expect(serialized).not.toContain("\u2028");
    expect(JSON.parse(serialized)).toEqual(data);
    expect(serialized).not.toMatch(
      /viewer|session|email|telephone|mobile|address/i,
    );
  });
});
