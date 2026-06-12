const USERNAME_PATTERN = /^[a-z0-9-]{1,20}$/;

export function isValidWelcomeUsername(username: string) {
  return USERNAME_PATTERN.test(username) && username !== "id";
}

export function parseWelcomeProfileForm(form: FormData) {
  const submittedImage = form.get("image");

  return {
    name: String(form.get("name") ?? "").trim(),
    username: String(form.get("username") ?? "").trim(),
    image:
      typeof submittedImage === "string" ? submittedImage.trim() || null : null,
  };
}
