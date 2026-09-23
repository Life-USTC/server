CREATE TABLE "PublicationImageSource" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicationImageSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublicationRevisionImageSource" (
    "revisionId" TEXT NOT NULL,
    "imageSourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationRevisionImageSource_pkey"
      PRIMARY KEY ("revisionId", "imageSourceId")
);

CREATE INDEX "PublicationImageSource_url_idx"
ON "PublicationImageSource"("url");
CREATE INDEX "PublicationRevisionImageSource_imageSourceId_revisionId_idx"
ON "PublicationRevisionImageSource"("imageSourceId", "revisionId");

ALTER TABLE "PublicationRevisionImageSource"
  ADD CONSTRAINT "PublicationRevisionImageSource_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "PublicationRevision"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationRevisionImageSource"
  ADD CONSTRAINT "PublicationRevisionImageSource_imageSourceId_fkey"
  FOREIGN KEY ("imageSourceId") REFERENCES "PublicationImageSource"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DO $publication_image_security$
DECLARE
  table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'life_ustc_runtime') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE
      public."PublicationImageSource", public."PublicationRevisionImageSource"
      TO life_ustc_runtime;
    FOREACH table_name IN ARRAY ARRAY[
      'PublicationImageSource', 'PublicationRevisionImageSource'
    ]
    LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO life_ustc_runtime USING (true) WITH CHECK (true)',
        table_name || '_runtime_access', table_name
      );
    END LOOP;
  END IF;
END
$publication_image_security$;
