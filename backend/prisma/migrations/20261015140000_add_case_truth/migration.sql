-- Case files now carry their full ground truth (cases.truth), a public briefing, and the extra police-file
-- fields for each suspect. Suspect state gains brokenClaims.
--
-- The new NOT NULL columns get a throwaway default so rows that already exist survive the migration, then
-- the default is dropped. Such rows hold empty placeholders: re-run `pnpm db:seed` to fill them in from
-- /cases (the seed upserts by slug, so existing sessions keep pointing at the same case).

-- AlterTable
ALTER TABLE "case_suspects"
ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "age" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fullName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "tie" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "whereabouts" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "case_suspects"
ALTER COLUMN "address" DROP DEFAULT,
ALTER COLUMN "age" DROP DEFAULT,
ALTER COLUMN "fullName" DROP DEFAULT,
ALTER COLUMN "tie" DROP DEFAULT,
ALTER COLUMN "whereabouts" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cases" DROP COLUMN "reactions",
ADD COLUMN     "briefing" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "truth" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "cases"
ALTER COLUMN "briefing" DROP DEFAULT,
ALTER COLUMN "truth" DROP DEFAULT;

-- AlterTable
ALTER TABLE "suspect_states" ADD COLUMN     "brokenClaims" TEXT[] DEFAULT ARRAY[]::TEXT[];
