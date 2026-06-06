-- AlterTable
ALTER TABLE "collaborator" ADD COLUMN     "user_id" TEXT;

-- CreateTable
CREATE TABLE "collaborator_invite" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "invitee_email" TEXT NOT NULL,
    "suggested_profile" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "collaborator_invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collaborator_invite_token_key" ON "collaborator_invite"("token");

-- AddForeignKey
ALTER TABLE "collaborator" ADD CONSTRAINT "collaborator_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborator_invite" ADD CONSTRAINT "collaborator_invite_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborator_invite" ADD CONSTRAINT "collaborator_invite_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
