import {
  comments as enComments,
  uploads as enUploads,
} from "../../messages/en-us.json";
import {
  comments as zhComments,
  uploads as zhUploads,
} from "../../messages/zh-cn.json";
import type { AppLocale } from "./config";

const copy = {
  "en-us": {
    comments: enComments,
    uploads: enUploads,
  },
  "zh-cn": {
    comments: zhComments,
    uploads: zhUploads,
  },
};

export function getSectionFeatureCopy(locale: AppLocale) {
  return copy[locale];
}
