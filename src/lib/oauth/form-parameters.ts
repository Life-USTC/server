export function findDuplicateOAuthFormParameter(
  params: URLSearchParams,
  singletonNames: readonly string[],
) {
  return singletonNames.find((name) => params.getAll(name).length > 1);
}
