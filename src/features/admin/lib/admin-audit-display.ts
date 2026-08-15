import type { AppLocale } from "@/i18n/config";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";

const messages = {
  "en-us": enUsMessages,
  "zh-cn": zhCnMessages,
} satisfies Record<AppLocale, typeof enUsMessages>;

const targetLabels = {
  "en-us": {
    account: "Account",
    calendar_feed: "Calendar feed",
    comment: "Comment",
    description: "Description",
    homework: "Homework",
    oauth_client: "OAuth client",
    oauth_consent: "OAuth authorization",
    passkey: "Passkey",
    section: "Section",
    session: "Session",
    upload: "Upload",
    user: "User",
  },
  "zh-cn": {
    account: "账户",
    calendar_feed: "日历订阅",
    comment: "评论",
    description: "简介",
    homework: "作业",
    oauth_client: "OAuth 客户端",
    oauth_consent: "OAuth 授权",
    passkey: "通行密钥",
    section: "教学班",
    session: "登录会话",
    upload: "上传",
    user: "用户",
  },
} satisfies Record<AppLocale, Record<string, string>>;

const metadataLabels = {
  "en-us": {
    authMethod: "Authentication method",
    changedFields: "Changed fields",
    provider: "Provider",
    reason: "Reason",
    scopeCount: "Scope count",
    sectionId: "Section",
    selfService: "Self-service",
    size: "Size",
    source: "Source",
    status: "Status",
  },
  "zh-cn": {
    authMethod: "认证方式",
    changedFields: "变更字段",
    provider: "登录提供方",
    reason: "原因",
    scopeCount: "权限数量",
    sectionId: "教学班",
    selfService: "用户自助",
    size: "大小",
    source: "来源",
    status: "状态",
  },
} satisfies Record<AppLocale, Record<string, string>>;

function recordValue(
  record: Record<string, unknown>,
  key: string,
  fallback: string,
) {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

export function auditActionLabel(locale: AppLocale, action: string) {
  return recordValue(
    messages[locale].settings.security.actions,
    action,
    action,
  );
}

export function auditChannelLabel(locale: AppLocale, channel: string) {
  return recordValue(
    messages[locale].settings.security.channels,
    channel,
    channel,
  );
}

export function auditOutcomeLabel(locale: AppLocale, outcome: string) {
  return recordValue(
    messages[locale].settings.security.outcomes,
    outcome,
    outcome,
  );
}

export function auditFeatureLabel(locale: AppLocale, feature: string) {
  const oauth = messages[locale].oauth as Record<string, unknown>;
  const oauthLabel = oauth[`scopeFeature_${feature}`];
  if (typeof oauthLabel === "string") return oauthLabel;
  return (targetLabels[locale] as Record<string, string>)[feature] ?? feature;
}

export function auditTargetLabel(locale: AppLocale, target: string) {
  return (targetLabels[locale] as Record<string, string>)[target] ?? target;
}

export function auditMetadataLabel(locale: AppLocale, key: string) {
  return (metadataLabels[locale] as Record<string, string>)[key] ?? key;
}
