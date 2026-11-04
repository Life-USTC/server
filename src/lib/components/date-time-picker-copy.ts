const copy = {
  "zh-cn": { time: "时间", done: "完成", previous: "上个月", next: "下个月" },
  "en-us": {
    time: "Time",
    done: "Done",
    previous: "Previous month",
    next: "Next month",
  },
};

export function dateTimePickerCopy(locale: "zh-cn" | "en-us") {
  return copy[locale];
}
