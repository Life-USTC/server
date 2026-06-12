import {
  deleteHomeworkAction,
  liftSuspensionAction,
  moderateCommentAction,
  moderateDescriptionAction,
} from "./admin-moderation-action-handlers";

export const adminModerationPageActions = {
  deleteHomework: deleteHomeworkAction,
  liftSuspension: liftSuspensionAction,
  moderateComment: moderateCommentAction,
  moderateDescription: moderateDescriptionAction,
};
