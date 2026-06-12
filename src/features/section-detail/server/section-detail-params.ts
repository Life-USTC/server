export function parseSectionJwId(value: string) {
  const jwId = Number(value);
  if (!Number.isInteger(jwId)) return null;
  return jwId;
}
