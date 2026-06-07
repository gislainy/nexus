-- CreateEnum
CREATE TYPE "EntryMode" AS ENUM ('EXISTING_SYSTEM', 'NEW_SYSTEM');

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "entry_mode" "EntryMode" NOT NULL DEFAULT 'NEW_SYSTEM';
