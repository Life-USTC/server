export function parseWelcomeProfileForm(form: FormData) {
  const submittedImage = form.get("image");

  return {
    callbackUrl: String(form.get("callbackUrl") ?? "").trim(),
    name: String(form.get("name") ?? "").trim(),
    username: String(form.get("username") ?? "").trim(),
    image:
      typeof submittedImage === "string" ? submittedImage.trim() || null : null,
  };
}
