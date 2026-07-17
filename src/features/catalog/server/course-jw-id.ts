export function courseJwIdWhere(jwId: number) {
  return {
    OR: [{ jwId }, { aliases: { some: { jwId } } }],
  };
}
