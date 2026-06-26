export function isAsciiControlCharacter(character: string) {
  const code = character.charCodeAt(0);
  return code < 32 || code === 127;
}

export function hasAsciiControlCharacters(value: string) {
  return Array.from(value).some(isAsciiControlCharacter);
}
