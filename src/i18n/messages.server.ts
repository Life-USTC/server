export async function getMessages(locale = "zh-cn") {
  return locale === "en-us"
    ? (await import("../../messages/en-us.json")).default
    : (await import("../../messages/zh-cn.json")).default;
}
