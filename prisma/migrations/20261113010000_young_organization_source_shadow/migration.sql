-- Shadow source observations only. Neither role is a globally resolved identity.
CREATE TABLE "YoungEventOrganizationSource" (
    "eventId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceObservedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "YoungEventOrganizationSource_pkey" PRIMARY KEY ("eventId", "role", "sourceId"),
    CONSTRAINT "YoungEventOrganizationSource_role_check" CHECK ("role" IN ('sponsor', 'organizer')),
    CONSTRAINT "YoungEventOrganizationSource_sourceId_check" CHECK (length("sourceId") > 0),
    CONSTRAINT "YoungEventOrganizationSource_eventId_fkey" FOREIGN KEY ("eventId")
        REFERENCES "YoungEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "YoungEventOrganizationSource_role_sourceId_eventId_idx"
    ON "YoungEventOrganizationSource"("role", "sourceId", "eventId");

-- Closed to the application and auth identities even on an older database whose
-- migration-owner default grants have not yet been tightened by role bootstrap.
REVOKE ALL ON TABLE "YoungEventOrganizationSource" FROM PUBLIC;
DO $$
DECLARE runtime_role TEXT;
BEGIN
    FOREACH runtime_role IN ARRAY ARRAY[
        'life_ustc_runtime', 'life_ustc_auth_runtime',
        'life_ustc_maintenance_runtime', 'life_ustc_function_owner',
        'life_ustc_importer'
    ] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = runtime_role) THEN
            EXECUTE format('REVOKE ALL ON TABLE "YoungEventOrganizationSource" FROM %I', runtime_role);
        END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_importer') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "YoungEventOrganizationSource" TO life_ustc_importer;
    END IF;
END
$$;
