export type HomeworkStyleGuideCopy = {
  styleGuideAdvisory: string;
  styleGuideAvoidChapter: string;
  styleGuideAvoidCourse: string;
  styleGuideDescriptionGuidance: string;
  styleGuideDescriptionTemplate: string;
  styleGuideNumberedPattern: string;
  styleGuideTitle: string;
  styleGuideTitleGuidance: string;
  styleGuideTopicPattern: string;
};

export const MCP_HOMEWORK_STYLE_GUIDE =
  "Advisory style guide only; never reject a request for formatting: use the exact title pattern 第{N}次作业 or {主题}作业, do not use chapter-only titles such as 第一章作业, and omit the course name/code. " +
  "Order description bullets as 题目 (required; use 未记录 if unknown), 提交方式, 提交地址, 备注; omit unknown optional fields.";
