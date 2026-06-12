type ClientTab = "trusted" | "public" | "disabled" | "all";

type OAuthClient = {
  disabled: boolean;
  skipConsent: boolean | null;
  tokenEndpointAuthMethod: string;
};

export function oauthClientGroups<TClient extends OAuthClient>(
  clients: TClient[],
) {
  return {
    trustedClients: clients.filter((client) => client.skipConsent),
    externalClients: clients.filter((client) => !client.skipConsent),
  };
}

export function visibleOAuthClientsForTab<TClient extends OAuthClient>(
  clients: TClient[],
  activeClientTab: ClientTab,
) {
  return clients.filter((client) => {
    if (activeClientTab === "trusted") {
      return client.skipConsent && !client.disabled;
    }
    if (activeClientTab === "public") {
      return client.tokenEndpointAuthMethod === "none" && !client.disabled;
    }
    if (activeClientTab === "disabled") return client.disabled;
    return true;
  });
}
