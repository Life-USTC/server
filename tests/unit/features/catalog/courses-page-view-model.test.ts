import { describe, expect, it } from "vitest";
import { buildCourseFilterOptions } from "@/features/catalog/lib/courses-page-view-model";

describe("course page filter options", () => {
  it("capitalizes only the initial character of education level labels", () => {
    const options = buildCourseFilterOptions({
      commonLabels: {
        allCategories: "All Categories",
        allClassTypes: "All Class Types",
        allEducationLevels: "All Education Levels",
        clear: "Clear",
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
        ],
      },
    });

    expect(options.educationLevelOptions).toEqual([
      { value: "", label: "All Education Levels" },
      { value: "1", label: "Postgraduate" },
      { value: "2", label: "Undergraduate" },
      { value: "3", label: "PhD" },
      { value: "4", label: "本科生" },
    ]);
  });
});
