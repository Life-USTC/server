import { createSectionHomework, updateSectionHomework } from "./homeworks";
import type { SectionDetailHomeworkActionInput } from "./section-detail-homework-action-types";
import { sectionHomeworkPayloadFromFormData } from "./section-detail-homework-form";

export function createSectionHomeworkSubmitActions(
  input: SectionDetailHomeworkActionInput,
  loadHomeworks: () => Promise<void>,
) {
  async function createHomework(event: SubmitEvent) {
    event.preventDefault();
    input.setHomeworkMessage("");
    const formElement = event.currentTarget as HTMLFormElement;
    const homeworkCopy = input.getHomeworkCopy();
    const { error, payload } = sectionHomeworkPayloadFromFormData({
      formData: new FormData(formElement),
      homeworkCopy,
      timestamps: {
        publishedAt: input.getCreateHomeworkPublishedAt(),
        submissionDueAt: input.getCreateHomeworkSubmissionDueAt(),
        submissionStartAt: input.getCreateHomeworkSubmissionStartAt(),
      },
    });
    if (error || !payload) {
      input.setHomeworkMessage(error);
      return;
    }
    const created = await createSectionHomework(input.getSectionId(), payload);
    if (!created) {
      input.setHomeworkMessage(homeworkCopy.createFailed);
      return;
    }
    await loadHomeworks();
    input.closeCreateHomeworkDialog();
    formElement.reset();
  }

  async function updateHomework(event: SubmitEvent) {
    event.preventDefault();
    const selectedHomework = input.getSelectedHomework();
    if (!selectedHomework) return;
    input.setEditHomeworkMessage("");
    const homeworkCopy = input.getHomeworkCopy();
    const { error, payload } = sectionHomeworkPayloadFromFormData({
      formData: new FormData(event.currentTarget as HTMLFormElement),
      homeworkCopy,
      timestamps: {
        publishedAt: input.getEditHomeworkPublishedAt(),
        submissionDueAt: input.getEditHomeworkSubmissionDueAt(),
        submissionStartAt: input.getEditHomeworkSubmissionStartAt(),
      },
    });
    if (error || !payload) {
      input.setEditHomeworkMessage(error);
      return;
    }

    const updateResult = await updateSectionHomework(
      selectedHomework.id,
      payload,
    );
    if (updateResult === "homework-error") {
      input.setEditHomeworkMessage(homeworkCopy.updateFailed);
      return;
    }
    if (updateResult === "description-error") {
      input.setEditHomeworkMessage(homeworkCopy.updateFailed);
      await loadHomeworks();
      return;
    }

    input.cancelEditHomework();
    await loadHomeworks();
  }

  return { createHomework, updateHomework };
}
