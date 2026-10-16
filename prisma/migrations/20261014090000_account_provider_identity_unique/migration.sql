-- Better Auth 1.7.7 narrowed AccountKey from (issuer, accountId) to
-- (providerId, accountId), so a provider/subject pair that appears twice would
-- make findAccountByKey ambiguous and could resolve to the wrong user. Name the
-- conflicting rows rather than letting a bare unique-violation report them.
--
-- Unlike its neighbours this file has no BEGIN/COMMIT, and creates the index
-- from inside the guard block. The migration runner already wraps each file in
-- a transaction, so any statement following a failed RAISE -- a COMMIT
-- included -- aborts with "current transaction is aborted" and that secondary
-- error is what gets surfaced instead of the message naming the rows.
DO $guard$
DECLARE
  v_conflicts text;
BEGIN
  SELECT string_agg(
           format('%s/%s (%s rows, issuers: %s)',
                  "provider", "providerAccountId", n, issuers),
           '; ' ORDER BY "provider", "providerAccountId")
    INTO v_conflicts
  FROM (
    SELECT "provider", "providerAccountId", count(*) AS n,
           array_agg(DISTINCT "issuer") AS issuers
    FROM public."Account"
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) AS duplicates;

  IF v_conflicts IS NOT NULL THEN
    RAISE EXCEPTION
      'Account rows share a provider/providerAccountId pair, which Better Auth 1.7.7 cannot disambiguate: %',
      v_conflicts;
  END IF;

  EXECUTE 'CREATE UNIQUE INDEX "Account_provider_providerAccountId_key"
             ON public."Account" ("provider", "providerAccountId")';
END;
$guard$;
