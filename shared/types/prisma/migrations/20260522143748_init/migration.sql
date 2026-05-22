-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "TechnicalDepth" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('MANAGER', 'ARCHITECT', 'DEVELOPER', 'CLINICAL', 'REGULATORY');

-- CreateEnum
CREATE TYPE "ProfileIdentificationMethod" AS ENUM ('DECLARATIVE', 'OWNER_REVISION');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'SUFFICIENT', 'AWAITING_DELEGATION', 'READY_FOR_ARGUMENTATION', 'COMPLETED');

-- CreateEnum
CREATE TYPE "QuestionInputType" AS ENUM ('BOOLEAN', 'SELECT', 'MULTI_SELECT', 'TEXT', 'SCALE');

-- CreateEnum
CREATE TYPE "QuestionInstanceStatus" AS ENUM ('PENDING', 'ANSWERED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AnswerConfidence" AS ENUM ('CERTAIN', 'UNCERTAIN', 'DELEGATED');

-- CreateEnum
CREATE TYPE "AnswerSource" AS ENUM ('MANUAL', 'ARTIFACT');

-- CreateEnum
CREATE TYPE "GitConnectionStatus" AS ENUM ('CONNECTED', 'SYNCING', 'FAILED');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('CODE', 'DOCUMENTATION', 'ARCHITECTURE_DIAGRAM', 'FHIR_RESOURCE', 'HL7_MESSAGE', 'OPENEHR_ARCHETYPE', 'DICOM_CONFIG', 'OTHER');

-- CreateEnum
CREATE TYPE "ArtifactOrigin" AS ENUM ('GIT', 'UPLOAD');

-- CreateEnum
CREATE TYPE "ArtifactAnalysisStatus" AS ENUM ('PENDING', 'ANALYZED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecommendationVerdict" AS ENUM ('NOT_RECOMMENDED', 'PARTIALLY_RECOMMENDED', 'STRONGLY_RECOMMENDED');

-- CreateEnum
CREATE TYPE "ArgumentAcceptabilityStatus" AS ENUM ('ACCEPTED', 'DEFEATED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('PLANNED', 'RUNNING', 'EVALUATING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EvaluationMethod" AS ENUM ('MANUAL', 'AUTOMATED', 'LLM_AS_JUDGE');

-- CreateTable
CREATE TABLE "DomainConfig" (
    "id" TEXT NOT NULL,
    "domainName" TEXT NOT NULL,
    "domainVersion" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "tagSet" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DimensionDefinition" (
    "id" TEXT NOT NULL,
    "domainConfigId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "DimensionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileDefinition" (
    "id" TEXT NOT NULL,
    "domainConfigId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "vocabulary" TEXT[],
    "technicalDepth" "TechnicalDepth" NOT NULL,

    CONSTRAINT "ProfileDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantDefinition" (
    "id" TEXT NOT NULL,
    "domainConfigId" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "structuralWarrant" TEXT NOT NULL,
    "sources" TEXT[],

    CONSTRAINT "WarrantDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VetoDefinition" (
    "id" TEXT NOT NULL,
    "domainConfigId" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evaluationRule" JSONB NOT NULL,
    "remediationPath" TEXT[],
    "sources" TEXT[],

    CONSTRAINT "VetoDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictDefinition" (
    "id" TEXT NOT NULL,
    "domainConfigId" TEXT NOT NULL,
    "dimensionAId" TEXT NOT NULL,
    "dimensionBId" TEXT NOT NULL,
    "conditionA" JSONB NOT NULL,
    "conditionB" JSONB NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "ConflictDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtifactVariable" (
    "id" TEXT NOT NULL,
    "domainConfigId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "extractionHint" TEXT NOT NULL,
    "mapsToQuestionId" TEXT NOT NULL,

    CONSTRAINT "ArtifactVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "domainConfigId" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collaborator" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "type" "ProfileType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "identificationMethod" "ProfileIdentificationMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "xstateSnapshot" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionTemplate" (
    "id" TEXT NOT NULL,
    "domainConfigId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "targetProfiles" "ProfileType"[],
    "textPt" TEXT NOT NULL,
    "textEn" TEXT NOT NULL,
    "textByProfile" JSONB NOT NULL,
    "inputType" "QuestionInputType" NOT NULL,
    "options" TEXT[],
    "isCriticalForArgument" BOOLEAN NOT NULL DEFAULT true,
    "isEntryNode" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuestionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionTemplateEdge" (
    "id" TEXT NOT NULL,
    "sourceTemplateId" TEXT NOT NULL,
    "targetTemplateId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "guard" JSONB,
    "profileTypes" "ProfileType"[],

    CONSTRAINT "QuestionTemplateEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionInstance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "templateId" TEXT,
    "parentInstanceId" TEXT,
    "generatedByLLM" BOOLEAN NOT NULL DEFAULT false,
    "llmPromptUsed" TEXT,
    "textShown" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "inputType" "QuestionInputType" NOT NULL,
    "options" TEXT[],
    "status" "QuestionInstanceStatus" NOT NULL DEFAULT 'PENDING',
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "skippedAt" TIMESTAMP(3),

    CONSTRAINT "QuestionInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionInstanceId" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" "AnswerConfidence" NOT NULL,
    "delegatedTo" TEXT,
    "epistemicConfidence" DOUBLE PRECISION NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "AnswerSource" NOT NULL,
    "artifactExtractionId" TEXT,
    "generatedByLLM" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitConnection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "gitRepoUrl" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "status" "GitConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "GitConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "gitConnectionId" TEXT,
    "type" "ArtifactType" NOT NULL,
    "origin" "ArtifactOrigin" NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT,
    "storageKey" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storageSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "analysisStatus" "ArtifactAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analyzedAt" TIMESTAMP(3),

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtifactExtraction" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "questionTemplateId" TEXT NOT NULL,
    "extractedValue" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidenceSnippet" TEXT NOT NULL,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtifactExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "verdict" "RecommendationVerdict" NOT NULL,
    "argumentAcceptability" JSONB NOT NULL,
    "orientationText" TEXT NOT NULL,
    "blockerDiagnosis" TEXT,
    "vetosTriggered" TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Argument" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "warrant" TEXT NOT NULL,
    "backingChunkIds" TEXT[],
    "claim" TEXT NOT NULL,
    "acceptability" "ArgumentAcceptabilityStatus" NOT NULL,
    "defeatedBy" TEXT,
    "suspendedByVeto" TEXT,

    CONSTRAINT "Argument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMBenchmarkRecord" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT,
    "provider" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "tokensIn" INTEGER NOT NULL,
    "tokensOut" INTEGER NOT NULL,
    "evaluationScore" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LLMBenchmarkRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkExperiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "candidateModels" TEXT[],
    "testPrompts" JSONB NOT NULL,
    "evaluationCriteria" JSONB NOT NULL,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'PLANNED',
    "winnerModel" TEXT,
    "decisionRationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BenchmarkExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkRun" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "tokensIn" INTEGER NOT NULL,
    "tokensOut" INTEGER NOT NULL,
    "evaluationScore" DOUBLE PRECISION NOT NULL,
    "evaluationMethod" "EvaluationMethod" NOT NULL,
    "evaluationNotes" TEXT,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenchmarkRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ArgumentGrounds" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArgumentGrounds_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainConfig_domainName_domainVersion_key" ON "DomainConfig"("domainName", "domainVersion");

-- CreateIndex
CREATE UNIQUE INDEX "DimensionDefinition_domainConfigId_id_key" ON "DimensionDefinition"("domainConfigId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileDefinition_domainConfigId_id_key" ON "ProfileDefinition"("domainConfigId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_questionInstanceId_key" ON "Answer"("questionInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_sessionId_key" ON "Recommendation"("sessionId");

-- CreateIndex
CREATE INDEX "_ArgumentGrounds_B_index" ON "_ArgumentGrounds"("B");

-- AddForeignKey
ALTER TABLE "DimensionDefinition" ADD CONSTRAINT "DimensionDefinition_domainConfigId_fkey" FOREIGN KEY ("domainConfigId") REFERENCES "DomainConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileDefinition" ADD CONSTRAINT "ProfileDefinition_domainConfigId_fkey" FOREIGN KEY ("domainConfigId") REFERENCES "DomainConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantDefinition" ADD CONSTRAINT "WarrantDefinition_domainConfigId_fkey" FOREIGN KEY ("domainConfigId") REFERENCES "DomainConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantDefinition" ADD CONSTRAINT "WarrantDefinition_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "DimensionDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VetoDefinition" ADD CONSTRAINT "VetoDefinition_domainConfigId_fkey" FOREIGN KEY ("domainConfigId") REFERENCES "DomainConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictDefinition" ADD CONSTRAINT "ConflictDefinition_domainConfigId_fkey" FOREIGN KEY ("domainConfigId") REFERENCES "DomainConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtifactVariable" ADD CONSTRAINT "ArtifactVariable_domainConfigId_fkey" FOREIGN KEY ("domainConfigId") REFERENCES "DomainConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_domainConfigId_fkey" FOREIGN KEY ("domainConfigId") REFERENCES "DomainConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaborator" ADD CONSTRAINT "Collaborator_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collaborator" ADD CONSTRAINT "Collaborator_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionTemplate" ADD CONSTRAINT "QuestionTemplate_domainConfigId_fkey" FOREIGN KEY ("domainConfigId") REFERENCES "DomainConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionTemplateEdge" ADD CONSTRAINT "QuestionTemplateEdge_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "QuestionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionTemplateEdge" ADD CONSTRAINT "QuestionTemplateEdge_targetTemplateId_fkey" FOREIGN KEY ("targetTemplateId") REFERENCES "QuestionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionInstance" ADD CONSTRAINT "QuestionInstance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionInstanceId_fkey" FOREIGN KEY ("questionInstanceId") REFERENCES "QuestionInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_artifactExtractionId_fkey" FOREIGN KEY ("artifactExtractionId") REFERENCES "ArtifactExtraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitConnection" ADD CONSTRAINT "GitConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_gitConnectionId_fkey" FOREIGN KEY ("gitConnectionId") REFERENCES "GitConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtifactExtraction" ADD CONSTRAINT "ArtifactExtraction_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtifactExtraction" ADD CONSTRAINT "ArtifactExtraction_questionTemplateId_fkey" FOREIGN KEY ("questionTemplateId") REFERENCES "QuestionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Argument" ADD CONSTRAINT "Argument_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Argument" ADD CONSTRAINT "Argument_defeatedBy_fkey" FOREIGN KEY ("defeatedBy") REFERENCES "Argument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LLMBenchmarkRecord" ADD CONSTRAINT "LLMBenchmarkRecord_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "BenchmarkExperiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkRun" ADD CONSTRAINT "BenchmarkRun_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "BenchmarkExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArgumentGrounds" ADD CONSTRAINT "_ArgumentGrounds_A_fkey" FOREIGN KEY ("A") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArgumentGrounds" ADD CONSTRAINT "_ArgumentGrounds_B_fkey" FOREIGN KEY ("B") REFERENCES "Argument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
