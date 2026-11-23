import {
  comments as enComments,
  subscriptions as enSubscriptions,
  uploads as enUploads,
} from "../../messages/en-us.json";
import {
  comments as zhComments,
  subscriptions as zhSubscriptions,
  uploads as zhUploads,
} from "../../messages/zh-cn.json";
import type { AppLocale } from "./config";

const copy = {
  "en-us": {
    comments: enComments,
    subscriptions: enSubscriptions,
    uploads: enUploads,
  },
  "zh-cn": {
    comments: zhComments,
    subscriptions: zhSubscriptions,
    uploads: zhUploads,
  },
};

export function getSectionFeatureCopy(locale: AppLocale) {
  return copy[locale];
}
