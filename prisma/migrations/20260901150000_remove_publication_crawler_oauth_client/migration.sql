-- Publication ingestion now authenticates with a dedicated Worker secret.
-- Remove the previously provisioned user-delegated OAuth client and its
-- dependent grants/tokens without touching any other OAuth application.
DELETE FROM "OAuthClient"
WHERE "clientId" = 'life-ustc-publication-crawler';
