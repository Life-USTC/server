const USERNAME_PATTERN = /^[a-z0-9-]{1,20}$/;

export function isValidSettingsUsername(username: string) {
  return USERNAME_PATTERN.test(username) && username !== "id";
}

export function parseSettingsProfileForm(form: FormData) {
  const rawUsername = String(form.get("username") ?? "").trim();
  const submittedImage = form.get("image");

  return {
    name: String(form.get("name") ?? "").trim(),
    username: rawUsername.length > 0 ? rawUsername : null,
    image:
      typeof submittedImage === "string" ? submittedImage.trim() || null : null,
  };
}
