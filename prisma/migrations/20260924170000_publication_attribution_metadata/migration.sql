ALTER TABLE "PublicationRevision" ADD COLUMN "reporter" TEXT, ADD COLUMN "editor" TEXT, ADD COLUMN "originalPublisher" TEXT;
ALTER TABLE "PublicationRevisionImageSource" ADD COLUMN "altText" TEXT, ADD COLUMN "title" TEXT, ADD COLUMN "caption" TEXT;
ALTER TABLE "PublicationObjectLink" ADD COLUMN "filename" TEXT, ADD COLUMN "sourceUrl" TEXT;
