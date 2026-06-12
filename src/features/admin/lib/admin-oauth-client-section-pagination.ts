export const OAUTH_CLIENTS_PER_SECTION_PAGE = 3;

export function oauthClientSectionPageCount(sectionClients: unknown[]) {
  return Math.max(
    1,
    Math.ceil(sectionClients.length / OAUTH_CLIENTS_PER_SECTION_PAGE),
  );
}

export function oauthClientSectionItems<Client>(
  sectionClients: Client[],
  currentPage: number,
) {
  const start = (currentPage - 1) * OAUTH_CLIENTS_PER_SECTION_PAGE;
  return sectionClients.slice(start, start + OAUTH_CLIENTS_PER_SECTION_PAGE);
}

export function oauthClientSectionStatus({
  currentPage,
  sectionClients,
  template,
}: {
  currentPage: number;
  sectionClients: unknown[];
  template: string;
}) {
  const start =
    sectionClients.length === 0
      ? 0
      : (currentPage - 1) * OAUTH_CLIENTS_PER_SECTION_PAGE + 1;
  const end = Math.min(
    currentPage * OAUTH_CLIENTS_PER_SECTION_PAGE,
    sectionClients.length,
  );
  return template
    .replace("{start}", String(start))
    .replace("{end}", String(end))
    .replace("{total}", String(sectionClients.length));
}
