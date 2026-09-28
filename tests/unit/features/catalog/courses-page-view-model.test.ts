import { describe, expect, it } from "vitest";
import { buildCourseFilterOptions } from "@/features/catalog/lib/courses-page-view-model";

describe("course page filter options", () => {
  it("course.education-level-display-casing", () => {
    const options = buildCourseFilterOptions({
      commonLabels: {
        allCategories: "All Categories",
        allClassTypes: "All Class Types",
        allEducationLevels: "All Education Levels",
        clear: "Clear",
        applyFilters: "Apply filters",
        loading: "Loading",
        next: "Next",
        nextPage: "Next page",
        pagination: "Pagination",
        previous: "Previous",
        previousPage: "Previous page",
        search: "Search",
      },
      filterOptions: {
        categories: [],
        classTypes: [],
        educationLevels: [
          { id: 1, namePrimary: "postgraduate" },
          { id: 2, namePrimary: "Undergraduate" },
          { id: 3, namePrimary: "PhD" },
          { id: 4, namePrimary: "本科生" },
          { id: 5, namePrimary: "MBA" },
          { id: 6, namePrimary: "MSc" },
          { id: 7, namePrimary: "postgraduate (PhD)" },
          { id: 8, nameCn: "研究生" },
        ],
      },
    });

    expect(options.educationLevelOptions).toEqual([
      { value: "", label: "All Education Levels" },
      { value: "1", label: "Postgraduate" },
      { value: "2", label: "Undergraduate" },
      { value: "3", label: "PhD" },
      { value: "4", label: "本科生" },
      { value: "5", label: "MBA" },
      { value: "6", label: "MSc" },
      { value: "7", label: "Postgraduate (PhD)" },
      { value: "8", label: "研究生" },
    ]);
  });
});
