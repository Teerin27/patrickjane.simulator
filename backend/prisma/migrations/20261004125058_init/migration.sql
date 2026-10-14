-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'SOLVED', 'COLD');

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "culpritId" TEXT NOT NULL,
    "verdictCorrect" TEXT NOT NULL,
    "verdictWrong" TEXT NOT NULL,
    "reactions" JSONB NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_suspects" (
    "caseId" UUID NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "short" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "alibi" TEXT NOT NULL,
    "opener" TEXT NOT NULL,
    "closer" TEXT NOT NULL,

    CONSTRAINT "case_suspects_pkey" PRIMARY KEY ("caseId","id")
);

-- CreateTable
CREATE TABLE "case_evidence" (
    "caseId" UUID NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sprite" TEXT NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "case_evidence_pkey" PRIMARY KEY ("caseId","id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "discoveredEvidence" TEXT[],
    "accusedId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suspect_states" (
    "sessionId" UUID NOT NULL,
    "suspectId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "composure" INTEGER NOT NULL,
    "questionsRemaining" INTEGER NOT NULL,
    "mood" TEXT NOT NULL,
    "commitments" TEXT[],
    "confrontedEvidence" TEXT[],
    "revealedSecrets" TEXT[],

    CONSTRAINT "suspect_states_pkey" PRIMARY KEY ("sessionId","suspectId")
);

-- CreateTable
CREATE TABLE "transcripts" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "suspectId" TEXT NOT NULL,
    "turn" INTEGER NOT NULL,
    "intent" TEXT NOT NULL,
    "playerMessage" TEXT NOT NULL,
    "evidenceId" TEXT,
    "reply" TEXT NOT NULL,
    "replyKind" TEXT NOT NULL,
    "stateSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cases_slug_key" ON "cases"("slug");

-- CreateIndex
CREATE INDEX "sessions_caseId_idx" ON "sessions"("caseId");

-- CreateIndex
CREATE INDEX "transcripts_sessionId_suspectId_idx" ON "transcripts"("sessionId", "suspectId");

-- AddForeignKey
ALTER TABLE "case_suspects" ADD CONSTRAINT "case_suspects_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_evidence" ADD CONSTRAINT "case_evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspect_states" ADD CONSTRAINT "suspect_states_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
