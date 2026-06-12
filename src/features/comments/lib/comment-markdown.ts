export function appendMarkdown(value: string, currentValue: string) {
  const prefix = currentValue && !currentValue.endsWith("\n") ? "\n" : "";
  return `${currentValue}${prefix}${value}`;
}

export function attachmentMarkdown(
  file: File,
  upload: { filename: string; id: string },
) {
  const url = `/api/uploads/${upload.id}/download`;
  return file.type.startsWith("image/")
    ? `![${upload.filename}](${url})`
    : `[${upload.filename}](${url})`;
}
