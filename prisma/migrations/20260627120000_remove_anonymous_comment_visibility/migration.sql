ALTER TABLE "Comment" ALTER COLUMN "visibility" DROP DEFAULT;

UPDATE "Comment"
SET
  "isAnonymous" = TRUE,
  "visibility" = 'public'::"CommentVisibility"
WHERE "visibility" = 'anonymous'::"CommentVisibility";

CREATE TYPE "CommentVisibility_new" AS ENUM ('public', 'logged_in_only');

ALTER TABLE "Comment"
  ALTER COLUMN "visibility" TYPE "CommentVisibility_new"
  USING ("visibility"::text::"CommentVisibility_new");

ALTER TYPE "CommentVisibility" RENAME TO "CommentVisibility_old";
ALTER TYPE "CommentVisibility_new" RENAME TO "CommentVisibility";
DROP TYPE "CommentVisibility_old";

ALTER TABLE "Comment" ALTER COLUMN "visibility" SET DEFAULT 'public';
