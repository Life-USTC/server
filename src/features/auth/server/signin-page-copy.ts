import type { AppLocale } from "@/i18n/config";
import {
  DEV_ADMIN_PROVIDER_ID,
  DEV_DEBUG_PROVIDER_ID,
  type getSignInProviderIds,
  OIDC_PROVIDER_ID,
} from "@/lib/auth/provider-ids";
import enUsMessages from "../../../../messages/en-us.json";
import zhCnMessages from "../../../../messages/zh-cn.json";

export const signInMessages = {
  "en-us": enUsMessages.signIn,
  "zh-cn": zhCnMessages.signIn,
} satisfies Record<AppLocale, typeof enUsMessages.signIn>;

export function providerNames(locale: AppLocale) {
  const copy = signInMessages[locale];
  return {
    [OIDC_PROVIDER_ID]: "USTC",
    github: "GitHub",
    google: "Google",
    [DEV_DEBUG_PROVIDER_ID]: copy.devDebugProvider,
    [DEV_ADMIN_PROVIDER_ID]: copy.devAdminProvider,
  } satisfies Record<ReturnType<typeof getSignInProviderIds>[number], string>;
}

export function signInWith(template: string, provider: string) {
  return template.replace("{provider}", provider);
}

export function parseTermsNotice(value: string) {
  const match = value.match(
    /^(.*)<terms>(.*)<\/terms>(.*)<privacy>(.*)<\/privacy>(.*)$/,
  );
  if (!match) {
    return {
      beforeTerms: value,
      terms: "Terms",
      between: " ",
      privacy: "Privacy",
      afterPrivacy: "",
    };
  }
  return {
    beforeTerms: match[1],
    terms: match[2],
    between: match[3],
    privacy: match[4],
    afterPrivacy: match[5],
  };
}
