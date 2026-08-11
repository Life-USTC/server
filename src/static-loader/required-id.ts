export function requiredId<K>(
  ids: ReadonlyMap<K, number>,
  key: K,
  description: string,
): number {
  const id = ids.get(key);
  if (id == null) {
    throw new Error(`${description} did not resolve from its upstream jwId`);
  }
  return id;
}

export function optionalId<K>(
  ids: ReadonlyMap<K, number>,
  key: K | null | undefined,
  description: string,
): number | null {
  return key == null ? null : requiredId(ids, key, description);
}
