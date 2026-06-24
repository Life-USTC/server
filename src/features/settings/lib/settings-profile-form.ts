export function parseSettingsProfileForm(form: FormData) {
  const submittedImage = form.get("image");

  return {
    name: String(form.get("name") ?? "").trim(),
    username: String(form.get("username") ?? "").trim(),
    image:
      typeof submittedImage === "string" ? submittedImage.trim() || null : null,
  };
}
