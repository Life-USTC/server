-- CreateIndex
CREATE INDEX "Schedule_sectionId_date_startTime_idx" ON "Schedule"("sectionId", "date", "startTime");

-- CreateIndex
CREATE INDEX "Exam_sectionId_examDate_startTime_idx" ON "Exam"("sectionId", "examDate", "startTime");

-- CreateIndex
CREATE INDEX "Homework_sectionId_deletedAt_submissionDueAt_idx" ON "Homework"("sectionId", "deletedAt", "submissionDueAt");

-- CreateIndex
CREATE INDEX "Comment_homeworkId_status_idx" ON "Comment"("homeworkId", "status");
