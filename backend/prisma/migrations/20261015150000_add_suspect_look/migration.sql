-- Suspects are drawn from a `look` (skin, hair, outfit...) stored with their police file.
-- Existing rows get an empty placeholder so the migration succeeds; re-run `pnpm db:seed` to fill it in from /cases.

-- AlterTable
ALTER TABLE "case_suspects" ADD COLUMN     "look" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "case_suspects" ALTER COLUMN "look" DROP DEFAULT;
