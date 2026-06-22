import { describe, expect, it } from "vitest";
import {
  validateCreateHomeworkForm,
  validateTodoForm,
} from "@/features/dashboard/lib/forms";

const todoCopy = {
  errorContentTooLong: "content too long",
  errorInvalidDueAt: "invalid due date",
  errorTitleRequired: "title required",
  errorTitleTooLong: "title too long",
  saveFailed: "save failed",
};

const homeworkCopy = {
  createFailed: "create failed",
  errorDescriptionTooLong: "description too long",
  errorInvalidSubmissionDue: "invalid submission due",
  errorSectionNotFound: "section not found",
  errorTitleRequired: "title required",
  errorTitleTooLong: "title too long",
};

describe("dashboard form validation", () => {
  it("uses strict todo due date parsing", () => {
    const formData = new FormData();
    formData.set("title", "Read Chapter 1");
    formData.set("dueAt", "2026-02-30T10:00");

    expect(validateTodoForm(formData, todoCopy)).toBe("invalid due date");
  });

  it("uses strict homework date parsing", () => {
    const formData = new FormData();
    formData.set("sectionId", "1");
    formData.set("title", "Project 1");
    formData.set("submissionDueAt", "2026-02-30T10:00");

    expect(validateCreateHomeworkForm(formData, homeworkCopy)).toBe(
      "invalid submission due",
    );
  });
});
